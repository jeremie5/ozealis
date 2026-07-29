# MCF8316D Commissioning Contract

This document defines the Ozealis commissioning boundary for future MCF8316D register communication. It is not a register implementation and it is not a validation result.

The first firmware surface is BLE characteristic `0032`, the encrypted read-only MCF8316D parameter snapshot. Firmware may report `state=readback_valid`, `runtimeSpeed=i2c`, and `commandReady=true` after volatile `ALGO_DEBUG1` speed-command write/readback is verified, but parameter and EEPROM writes still report `writesAllowed=false`. Keep parameter-register readback and write behavior unavailable until that layer is implemented, tested on a bench fixture, and documented here.

Machine-readable manifest: [`mcf8316d-register-manifest.json`](mcf8316d-register-manifest.json). Keep the manifest and this document in sync; firmware/mobile code should use the manifest as the stable contract before any register write path is added.

## Goals

- Archive the exact MCF8316D configuration used for any motor calibration run.
- Make speed-command mode, MPET state, and motor-specific parameters visible before calibration.
- Permit future writes only through an explicit idle commissioning flow.
- Block airflow start and calibration while parameter writes or readback verification are incomplete.
- Keep every exported snapshot useful to someone rebuilding the device later.

## Non-Goals

- No medical, safety, acoustic, or reliability validation.
- No automatic selection of motor parameters without independent bench instrumentation.
- No BLE write path for arbitrary register pokes.
- No hidden writes from normal telemetry, start, stop, or calibration controls.

## Minimum Snapshot Shape

The `0032` snapshot must remain JSON. When parameter-register reads exist, extend the current speed-command snapshot instead of replacing it:

```json
{
  "driver": "MCF8316D",
  "state": "readback_valid",
  "i2c": true,
  "fault": false,
  "i2cAddr": "0x01",
  "runtimeSpeed": "i2c",
  "targetSpeed": "i2c",
  "commandReady": true,
  "writesAllowed": false,
  "benchOnly": false,
  "fgHz": 0.0,
  "commandAmp": 0,
  "commandPwm": 0,
  "pins": {
    "speedPwm": 19,
    "drvOff": 17,
    "nFault": 26,
    "fg": 33
  },
  "source": "shadow",
  "registerRevision": "datasheet-checked",
  "registers": [
    { "name": "MOTOR_RES", "addr": "0x000080", "value": "0x00000000", "source": "shadow", "verified": true }
  ]
}
```

Register names and addresses must come from the current TI MCF8316D datasheet or exported TI GUI configuration. Do not invent names in firmware.

Until addresses are sourced and reviewed, the manifest keeps required parameter addresses as `null` with `addressSource` set to `datasheet_or_ti_gui_export_required`.

## Essential Parameters

At minimum, the commissioning snapshot must include these motor-specific fields when the register layer is implemented:

- `MOTOR_RES`
- `MOTOR_IND`
- `MOTOR_BEMF_CONST`
- `SPD_LOOP_KP`
- `SPD_LOOP_KI`
- `MAX_SPEED`
- speed input mode or equivalent field proving I2C speed command is configured
- any current limit, acceleration, brake, startup, and fault configuration fields used by Ozealis calibration

If any of `MOTOR_RES`, `MOTOR_IND`, `MOTOR_BEMF_CONST`, `SPD_LOOP_KP`, or `SPD_LOOP_KI` are zero, the snapshot must flag that MPET or manual tuning is still required before longer bench runs.

## EEPROM And Shadow Readback

The MCF8316D datasheet describes EEPROM readback as a staged operation:

1. Write `0x40000000` to register `0x0000EA` to load EEPROM data into shadow/RAM registers.
2. Wait at least `100 ms`.
3. Read shadow/RAM registers from `0x000080` through `0x0000AE`.

The snapshot must identify whether each value came from shadow/RAM, volatile runtime status, or an exported configuration file. Shadow/RAM register addresses increase in 16-bit locations; 32-bit reads advance by two addresses.

## EEPROM Security

The MCF8316D can require a passcode or permanently lock EEPROM reads/writes. Ozealis must treat EEPROM access failure as a commissioning state, not as a normal runtime fault:

- `eeprom_access_unknown`
- `eeprom_read_allowed`
- `eeprom_key_required`
- `eeprom_write_locked`
- `eeprom_locked_permanent`

Do not store EEPROM passcodes in source, logs, mobile app state, exported snapshots, or documentation examples.

## Write Gating

Future parameter writes must satisfy all of these conditions:

- system mode is idle
- calibration is inactive
- motor command is zero
- `DRVOFF` is asserted
- MCF8316D responds on I2C
- `nFAULT` is not asserted
- mobile app shows an explicit commissioning action
- post-write readback exactly matches the intended values
- start and calibration remain unavailable until verification succeeds

Normal settings writes, start/stop, clear fault, telemetry, and log reads must never write MCF8316D parameter registers.

## MPET Boundary

MPET or motor-parameter extraction is bench-only. It may spin the motor while measuring parameters, so it must not run from an ordinary start command. A future MPET command must require:

- explicit commissioning mode
- instrumented bench setup
- current and temperature monitoring
- independent pressure observation
- immediate abort path from BLE stop and physical button
- readback/export after completion

## Export Requirements

Every exported snapshot should include:

- firmware commit or build identifier when available
- board revision when available
- driver part, I2C address, and target speed-command mode
- current I2C presence and driver fault-latch state
- current finite FG tach frequency estimate as `fgHz`, shown in the mobile Advanced MCF8316D parameter panel as Snapshot FG; unavailable or out-of-range tach evidence reports `0` while `commandReady`, `state`, and fault fields remain authoritative
- command-readiness summary plus the underlying readiness fields used to derive it
- register source and verification state
- complete motor-specific parameter set
- fault/status fields read during the same session
- calibration profile identifier or timestamp when available
- `writesAllowed=false` unless an explicit commissioning write flow is active

## References

- TI MCF8316D datasheet
- TI SLLA662, "How to Program I2C for MCx83xx Device Family"
