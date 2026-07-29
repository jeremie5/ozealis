# Rev 3 Motor Driver

Ozealis Rev 3 uses a code-free sensorless FOC driver so the blower drive is quieter, easier to assemble, and less dependent on hand-tuned analog sensing.

This is an architecture direction for schematic and firmware planning. It is not a validation result, and it does not prove any blower/motor combination is appropriate for any use.

## Preferred Driver

Use TI `MCF8316DVRGFR` as the preferred Rev 3 motor driver.

- JLCPCB part: `C47122159`
- package: `VQFN-40`
- supply class: 12 V to 24 V BLDC/PMSM systems
- motor control: integrated code-free sensorless FOC
- power stage: integrated MOSFET half-bridges
- current feedback: integrated current sensing, no external sense resistors
- command interfaces: I2C speed command as the Rev 3 D-variant target; PWM retained only as an explicit bench fallback build option
- configuration: EEPROM-stored motor and startup parameters
- diagnostics: `nFAULT`, fault/status access over I2C

Before committing a PCB release, re-check distributor stock, TI lifecycle status, JLCPCB assembly availability, and the current datasheet revision.

## Removed Legacy Driver Path

Moving to `MCF8316DVRGFR` removes the discrete phase-drive firmware path from the active design. New boards should not carry the old resistor network or LM339 BEMF sensing path. The ESP32 commands blower speed/torque indirectly and reads faults/status instead of generating low-level commutation timing.

Expected benefits:

- fewer analog parts and fewer calibration-sensitive component values
- less board-level variation between volunteer-built devices
- quieter startup and running behavior from integrated sensorless FOC
- integrated current sensing and protection hooks for fault logging
- less firmware flash pressure from custom motor commutation code

## Firmware Impact

Rev 3 firmware treats the motor driver as a configured actuator, not a raw three-phase bridge.

Firmware responsibilities:

- probe the default `0x01` MCF8316D I2C target address during motor setup and re-probe before any motor start or calibration sweep
- refuse motor start or calibration and enter the normal `FAULT_IO` path if the driver does not respond
- re-check driver readiness inside the motor command wrapper before accepting any nonzero command, then remove command and assert `DRVOFF` if the driver is no longer ready
- command speed over I2C by writing the D-specific `ALGO_DEBUG1` `DIGITAL_SPEED_CTRL` field with `OVERRIDE=1`, then reading the register back before accepting the command
- refuse nonzero motor command in default builds unless the I2C speed-command write/readback path has been verified for the current boot
- keep PWM speed command available only behind `OZEALIS_BENCH_PWM_SPEED_FALLBACK=1` for instrumented bench bring-up
- configure and verify driver registers over I2C through explicit commissioning/readback flows
- treat asserted `nFAULT` as firmware `FAULT_IO`, stop the motor command, and capture a fault log snapshot
- expose driver fault/status fields in BLE live CSV and fault logs
- count the `FG` tach output on GPIO 33 and expose `motor_fg_hz` / `motorFgHz` in live, retained, and fault CSV evidence
- keep pressure-loop logic in Ozealis firmware, but map pressure command to driver speed command units
- keep the bench calibration suite, but calibrate pressure response against driver command units
- require idle-only driver EEPROM writes and motor-parameter extraction runs

Current firmware uses I2C for target presence probing and volatile speed commands. It writes `ALGO_DEBUG1` with `OVERRIDE=1` and `DIGITAL_SPEED_CTRL` mapped from the pressure-controller command, reads that register back, and blocks start/calibration if the readback is not verified. While idle with zero command and no driver fault, the readiness path and MCF snapshot read retry a zero-speed command/readback so a driver powered or repaired after boot can become command-ready without reflashing. A PWM speed-command path remains only as an explicit bench compile option while broader MCF8316D parameter readback, EEPROM writes, MPET, and commissioning flows remain unavailable.

Future register reads/writes should follow TI application note SLLA662 for MCx83xx I2C transactions: use the 7-bit target address, treat `0x01` as the default target ID unless EEPROM has been programmed otherwise, do not expect target-address changes to take effect until after EEPROM programming and power cycling, and include the documented byte-spacing/retry behavior for reliable register access. Parameter writes must be idle-only, with command at zero, `DRVOFF` asserted, no calibration sweep active, and no user-facing start path available until register verification completes.

Planned motor-parameter communication scope:

- keep the first BLE commissioning surface read-only as `0032` MCF8316D parameter snapshot until parameter-register reads are implemented; speed-command readback may report `state=readback_valid` while `writesAllowed=false`
- read volatile and EEPROM-backed driver parameter registers into a firmware-owned snapshot
- expose a BLE readback/export path so builders can archive the exact MCF8316D configuration used for a calibration run
- accept parameter writes only through an explicit idle commissioning flow
- require a post-write readback match before calibration or airflow start is allowed
- keep MPET or other motor-parameter extraction commands bench-only and blocked while airflow is running

Commissioning contract: [MCF8316D Commissioning Contract](mcf8316d-commissioning.md).

Bench bring-up sequence: [MCF8316D Bench Bring-Up](mcf8316d-bringup.md).

## Hardware Notes

The part is plausible for a 24 V blower target, but the 75 W claim must be proven against the actual motor and airflow load.

### Schematic Integration Checklist

New MCF8316D boards should replace the legacy BLDC driver, LM339 BEMF comparator network, phase resistor dividers, external motor MOSFET/gate-drive path, and external motor current-sense resistors with the integrated FOC driver path below.

Default ESP32 connections:

| MCF8316D signal | ESP32 signal | Notes |
| --- | --- | --- |
| `SDA` | GPIO 21 / `Wire` SDA | Shared I2C bus, pull up to 3.3 V |
| `SCL` | GPIO 22 / `Wire` SCL | Shared I2C bus, pull up to 3.3 V |
| `DRVOFF` | GPIO 17 / `MCF_DRVOFF_PIN` | High disables/coasts all MOSFETs, low allows drive |
| `nFAULT` | GPIO 26 / `MCF_NFAULT_PIN` | Active-low fault input |
| `FG` | GPIO 33 / `MCF_FG_PIN` | Tach input, pull up to 3.3 V |
| `SPEED/WAKE` | GPIO 19 / `MOTOR_SPEED_PWM_PIN` | Optional wake or explicit bench PWM fallback/test signal |

Recommended surrounding components to include from the TI MCF8316D typical application:

| Area | Recommended parts / routing |
| --- | --- |
| VM bypass | `0.1 uF` X7R from `VM` to `PGND` close to the IC, plus at least `10 uF` from `VM` to `PGND`; add a larger local bulk footprint, such as `100 uF` to `470 uF` at 35 V or higher, on the 24 V motor rail and size it by bench testing. |
| Charge pump | `1 uF` X7R, 16 V from `CP` to `VM`; `47 nF` X7R from `CPH` to `CPL`. |
| AVDD | `1 uF` X7R, at least 10 V from `AVDD` to `AGND`; choose a part whose effective capacitance remains about `0.7 uF` to `1.3 uF` at 3.3 V across temperature. Do not power the ESP32 from `AVDD` or use this rail for high-load external circuitry. |
| DVDD | `1 uF` X7R, at least 6.3 V from `DVDD` to `DGND`; choose a part whose effective capacitance remains about `0.7 uF` to `2.5 uF` at 1.5 V across temperature. Treat as local driver bypass only and do not power external loads from `DVDD`. |
| Buck support | If the MCF buck is not powering external loads, fit resistor mode with `22 ohm` from `SW_BK` to `FB_BK` and `22 uF` X7R from `FB_BK` to `GND_BK`; do not power the ESP32, pressure sensors, BLE module, display, or other board loads from this rail. For a later board that intentionally uses the buck for external load, replace the resistor with a `47 uH` inductor for up to 170 mA or `22 uH` for up to 20 mA, then re-check thermal and noise behavior. |
| I2C pullups | `5.1 kOhm` from `SDA` to 3.3 V and `5.1 kOhm` from `SCL` to 3.3 V. |
| Fault pullup | `5.1 kOhm` from `nFAULT` to 3.3 V. |
| FG pullup | `5.1 kOhm` to `10 kOhm` from `FG` to 3.3 V; a small `100 ohm` to `330 ohm` series resistor near the ESP32 input is acceptable for prototype signal hygiene. |
| Direction | Tie `DIR` to `AGND` or `AVDD` for the selected blower phase order; no ESP32 pin is required for normal Ozealis operation. |
| Brake | Tie `BRAKE` low for normal operation unless a later board revision intentionally routes it; high requests brake behavior. |
| Disable | Route `DRVOFF` to GPIO 17 and add a local pullup to the driver logic rail so reset and ESP32 boot states hold the MCF8316D outputs disabled; firmware pulls `DRVOFF` low only after readiness gates pass. |
| Motor phases | Route `OUTA`, `OUTB`, and `OUTC` directly to the three blower phases with short, wide copper. |
| Test access | Add test pads for `VM`, 3.3 V, `FB_BK`, `AVDD`, `DVDD`, `SDA`, `SCL`, `DRVOFF`, `nFAULT`, `FG`, `SPEED/WAKE`, `OUTA`, `OUTB`, and `OUTC`. Optional pads for `DACOUT1`, `DACOUT2`, and `ALARM` help tuning and failure analysis. |

EasyEDA Copilot schematic note: include `MCF8316DVRGFR` with `VM` pins 9/10/11 tied to the 24 V motor rail, `PGND` pins 12/15/18 to power ground, thermal pad to `AGND` ground copper with thermal vias, `OUTA` pins 13/14, `OUTB` pins 16/17, and `OUTC` pins 19/20 routed to the blower connector. Tie `BRAKE` low. Tie `DIR` to the desired fixed direction rail. Route `SDA`, `SCL`, `DRVOFF`, `nFAULT`, and optional `SPEED/WAKE` to the ESP32 pins listed above.

Copyable schematic contract for EasyEDA Copilot:

```text
Replace the legacy BLDC driver, LM339 BEMF network, phase resistor dividers, external MOSFET/gate-drive path, and external motor current-sense resistors with one TI MCF8316DVRGFR.

MCF8316DVRGFR power and motor:
- VM pins 9/10/11 -> 24 V motor rail.
- PGND pins 12/15/18 -> power ground.
- Exposed thermal pad -> AGND/ground copper with thermal vias.
- OUTA pins 13/14, OUTB pins 16/17, OUTC pins 19/20 -> three-phase blower connector with short, wide copper.

Required support parts:
- 0.1 uF X7R VM-to-PGND close to the IC.
- At least 10 uF VM-to-PGND close to the IC.
- Bulk capacitor footprint on 24 V rail, 100 uF to 470 uF, 35 V or higher, sized after bench testing.
- 1 uF X7R, 16 V from CP to VM.
- 47 nF X7R from CPH to CPL.
- 1 uF X7R, at least 10 V from AVDD to AGND; do not power ESP32 from AVDD.
- 1 uF X7R, at least 6.3 V from DVDD to DGND; do not power external loads from DVDD.
- Buck resistor mode: 22 ohm from SW_BK to FB_BK and 22 uF X7R from FB_BK to GND_BK.
- Do not power ESP32, pressure sensors, BLE, display, or other board loads from the MCF buck unless a later power redesign explicitly validates it.

ESP32 control pins:
- SDA -> ESP32 GPIO21 / Wire SDA, 5.1 kOhm pullup to 3.3 V.
- SCL -> ESP32 GPIO22 / Wire SCL, 5.1 kOhm pullup to 3.3 V.
- DRVOFF -> ESP32 GPIO17 / MCF_DRVOFF_PIN, with a local pullup to the driver logic rail so reset and ESP32 boot states hold the MCF8316D outputs disabled.
- nFAULT -> ESP32 GPIO26 / MCF_NFAULT_PIN, 5.1 kOhm pullup to 3.3 V.
- FG -> ESP32 GPIO33 / MCF_FG_PIN, 5.1 kOhm to 10 kOhm pullup to 3.3 V, optional 100 ohm to 330 ohm series resistor near the ESP32.
- SPEED/WAKE -> optional ESP32 GPIO19 / MOTOR_SPEED_PWM_PIN test path only for explicit bench PWM fallback builds.

Fixed logic and test access:
- Tie BRAKE low for normal operation.
- Tie DIR to AGND or AVDD for the chosen blower direction; no ESP32 pin is needed.
- Add test pads for VM, 3.3 V, FB_BK, AVDD, DVDD, SDA, SCL, DRVOFF, nFAULT, FG, SPEED/WAKE, OUTA, OUTB, OUTC, and optional DACOUT/ALARM.
```

Use the TI layout guidance for the driver thermal pad, VM bulk capacitor placement, high-current phase routing, and AGND/PGND partitioning. The thermal pad must be soldered to a ground plane with multiple vias, and the high-current motor loop should stay physically away from pressure-sensor and ESP32 antenna-sensitive routing.

Before release hardware:

- verify startup current, steady-state current, and fault current with independent instruments
- validate thermal rise at worst-case ambient, enclosure airflow, and expected blower load
- use copper pours, thermal vias, and layout guidance from the TI datasheet/EVM
- route `nFAULT` to the ESP32
- expose I2C access for configuration and recovery
- keep a hard motor-disable path such as `DRVOFF`
- expose I2C access for speed command, configuration, readback, and recovery
- keep a PWM speed-command test option on early prototypes only for explicit bench builds when isolating the D I2C speed path
- add test points for VM, buck/LDO rails, phase outputs, `nFAULT`, `FG`, I2C, and bench speed-command fallback

## Fallback Part Class

`DRV8316`-class drivers are fallback candidates only if the project intentionally chooses MCU-side FOC later. They integrate MOSFETs and current sensing, but they do not remove the firmware burden the same way a code-free `MCF8316D` design does.

## References

- TI SLLA662, "How to Program I2C for MCx83xx Device Family"
- TI MCF8316D datasheet
