#!/usr/bin/env python3
"""
mavlink_ws_bridge.py
────────────────────
Real MAVLink -> WebSocket bridge for Swarm GCS.
Auto-detects COM port, connects at 115200 baud, and
broadcasts all MAVLink messages as JSON over WebSocket at
ws://localhost:8088/ws/mavlink

Usage (auto-detect COM, 115200 baud):
  python mavlink_ws_bridge.py

Override connection manually:
  python mavlink_ws_bridge.py --connection COM5,115200
  python mavlink_ws_bridge.py --connection udp:localhost:14550
  python mavlink_ws_bridge.py --connection tcp:192.168.1.100:5760

Dependencies (already installed):
  pip install pymavlink websockets pyserial
"""

import asyncio
import json
import argparse
import threading
import time
import sys
import serial.tools.list_ports
from pymavlink import mavutil
import websockets

# ── Config ────────────────────────────────────────────────────────────────────
WS_HOST  = "localhost"
WS_PORT  = 8088
WS_PATH  = "/ws/mavlink"
BAUD     = 115200

# MAVLink messages to forward to GCS
WANTED_MSGS = {
    "GLOBAL_POSITION_INT",
    "ATTITUDE",
    "SYS_STATUS",
    "HEARTBEAT",
    "GPS_RAW_INT",
    "VFR_HUD",
    "BATTERY_STATUS",
    "STATUSTEXT",
}

# Keywords that indicate a drone/telemetry radio COM port
DRONE_PORT_KEYWORDS = [
    "ardupilot", "pixhawk", "cube", "holybro", "3dr", "sik",
    "ftdi", "ch340", "cp210", "uart", "usb serial", "telemetry",
    "mavlink", "drone", "uav",
]

# ── Shared state ──────────────────────────────────────────────────────────────
connected_clients: set = set()
latest_messages: dict  = {}   # sysid -> {msg_type -> json_dict}
_lock = threading.Lock()
loop: asyncio.AbstractEventLoop = None
_mav_instance = None


# ── COM port auto-detection ───────────────────────────────────────────────────
def detect_com_port() -> str:
    """
    Scans all available COM ports and returns the best match.
    Priority order:
      1. Port whose description matches known drone/radio keywords
      2. First available COM port (if only one exists)
      3. Prompts user to pick from list (if multiple and none match)
    """
    while True:
        ports = list(serial.tools.list_ports.comports())
        if not ports:
            print("[AutoDetect] Waiting for drone to be plugged in...")
            time.sleep(2)
            continue
        break

    print("[AutoDetect] Available COM ports:")
    for i, p in enumerate(ports):
        print(f"  [{i}] {p.device:10s}  -  {p.description}")

    # Try keyword match first
    for p in ports:
        desc_lower = (p.description or "").lower()
        hwid_lower = (p.hwid or "").lower()
        if any(kw in desc_lower or kw in hwid_lower for kw in DRONE_PORT_KEYWORDS):
            print(f"[AutoDetect] [OK] Matched drone/radio port: {p.device} ({p.description})")
            return p.device

    # Only one port available -> use it
    if len(ports) == 1:
        print(f"[AutoDetect] [OK] Single port found, using: {ports[0].device}")
        return ports[0].device

    # Multiple ports, no keyword match -> ask user
    print("[AutoDetect] Could not auto-identify drone port.")
    while True:
        try:
            choice = input(f"  Enter port number [0-{len(ports)-1}] or full name (e.g. COM3): ").strip()
            if choice.upper().startswith("COM") or choice.startswith("/dev/"):
                return choice
            idx = int(choice)
            if 0 <= idx < len(ports):
                return ports[idx].device
        except (ValueError, KeyboardInterrupt):
            pass
        print("  Invalid selection, try again.")


def mavlink_reader(connection_string_arg: str):
    while True:
        # Determine connection string
        if connection_string_arg:
            connection_string = connection_string_arg
        else:
            com = detect_com_port()
            connection_string = f"{com},{BAUD}"

        print(f"[MAVLink] Connecting to: {connection_string} ...")
        try:
            mav = mavutil.mavlink_connection(connection_string, autoreconnect=True)
            global _mav_instance
            _mav_instance = mav
            print("[MAVLink] Waiting for heartbeat (up to 30 s)...")
            mav.wait_heartbeat(timeout=30)
            print(f"[MAVLink] [OK] Heartbeat received - sysid={mav.target_system}  compid={mav.target_component}")
            
            try:
                mav.mav.request_data_stream_send(
                    mav.target_system,
                    mav.target_component,
                    mavutil.mavlink.MAV_DATA_STREAM_ALL,
                    10, 1
                )
            except Exception as e:
                print(f"[MAVLink] [ERROR] Failed to request data stream: {e}")
        except Exception as e:
            print(f"[MAVLink] [ERROR] Connection failed: {e}. Retrying in 5s...")
            time.sleep(5)
            continue

        last_heartbeat = time.time()
        mav.is_disconnected = False
        consecutive_errors = 0

        while True:
            if time.time() - last_heartbeat > 3:
                if not getattr(mav, 'is_disconnected', False):
                    print("[MAVLink] Link lost – sending DISCONNECT")
                    payload = {
                        "key": "a",
                        "message": { "type": "DISCONNECT", "text": "Serial link lost" }
                    }
                    if loop:
                        asyncio.run_coroutine_threadsafe(broadcast(json.dumps(payload)), loop)
                    with _lock:
                        latest_messages.pop(mav.target_system, None)
                    mav.is_disconnected = True

            try:
                msg = mav.recv_match(blocking=True, timeout=1)
                consecutive_errors = 0
                if msg is None:
                    continue
                
                last_heartbeat = time.time()
                mav.is_disconnected = False

                msg_type = msg.get_type()
                if msg_type in ("BAD_DATA", "UNKNOWN") or msg_type not in WANTED_MSGS:
                    continue

                sysid = msg.get_srcSystem()
                d     = msg.to_dict()
                d["type"] = msg_type

                payload = {
                    "header": { "system_id": sysid, "component_id": msg.get_srcComponent() },
                    "message": d,
                }

                with _lock:
                    if sysid not in latest_messages:
                        latest_messages[sysid] = {}
                    latest_messages[sysid][msg_type] = payload

                if loop:
                    asyncio.run_coroutine_threadsafe(broadcast(json.dumps(payload)), loop)

            except Exception as e:
                print(f"[MAVLink] Reader error: {e}")
                consecutive_errors += 1
                time.sleep(1)
                # If we get errors for 5 straight seconds, force a full port re-detect
                if consecutive_errors > 5:
                    print("[MAVLink] Too many errors, restarting connection...")
                    break



# ── WebSocket broadcast ───────────────────────────────────────────────────────
async def broadcast(message: str):
    dead = set()
    for ws in list(connected_clients):
        try:
            await ws.send(message)
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


async def ws_handler(websocket):
    # Support both old and new websockets API for path
    try:
        path = websocket.request.path
    except AttributeError:
        path = getattr(websocket, "path", WS_PATH)

    if path != WS_PATH:
        await websocket.close(1008, "wrong path")
        return

    connected_clients.add(websocket)
    addr = websocket.remote_address
    print(f"[WS] + Client connected: {addr}  (total: {len(connected_clients)})")

    # Send latest cached state immediately on connect
    with _lock:
        for sysid, msgs in latest_messages.items():
            for payload in msgs.values():
                try:
                    await websocket.send(json.dumps(payload))
                except Exception:
                    break

    try:
        async for ws_msg in websocket:
            try:
                data = json.loads(ws_msg)
                if data.get("action") == "ARM":
                    sysid = data.get("sysid", 1)
                    arm = data.get("arm", 1)
                    if _mav_instance:
                        _mav_instance.mav.command_long_send(
                            sysid, 1,
                            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
                            0,
                            arm, 0, 0, 0, 0, 0, 0
                        )
                        print(f"[WS] Sent ARM={arm} command to sysid={sysid}")
            except Exception as e:
                print(f"[WS] Error processing msg: {e}")
    except Exception:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"[WS] - Client disconnected: {addr}  (total: {len(connected_clients)})")


# ── Main ──────────────────────────────────────────────────────────────────────
async def main_async(connection_string: str):
    global loop
    loop = asyncio.get_running_loop()

    t = threading.Thread(target=mavlink_reader, args=(connection_string,), daemon=True)
    t.start()

    print(f"[WS] WebSocket server starting -> ws://{WS_HOST}:{WS_PORT}{WS_PATH}")
    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        print(f"[WS] [OK] Ready - open GCS at http://localhost:3000")
        print( "[WS]   Press Ctrl+C to stop.\n")
        await asyncio.Future()   # run forever


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="MAVLink WebSocket Bridge for Swarm GCS (auto COM detect, 115200 baud)",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "--connection", "-c",
        default=None,
        help=(
            "MAVLink connection string (optional - auto-detected if omitted).\n"
            "Examples:\n"
            "  COM3,115200           Windows USB / telemetry radio\n"
            "  udp:localhost:14550   SITL or QGC MAVLink forward\n"
            "  tcp:192.168.1.1:5760  Companion computer TCP\n"
        ),
    )
    args = parser.parse_args()

    if args.connection:
        conn = args.connection
    else:
        conn = None

    try:
        asyncio.run(main_async(conn))
    except KeyboardInterrupt:
        print("\n[Bridge] Stopped.")
