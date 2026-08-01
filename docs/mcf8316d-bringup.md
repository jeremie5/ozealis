# MCF8316D Bench Bring-Up

This checklist is for bench-only Rev 3 motor-driver bring-up. Do not connect the blower output to a person during these tests. It is an experimental hardware validation flow, not a safety claim, medical claim, or proof that any motor, blower, enclosure, or firmware build is appropriate for use.

Run this sequence with external instruments available: current-limited supply, multimeter, oscilloscope or logic analyzer, independent pressure sensor, and a way to monitor driver and board temperature.

## 1. Before Power

- Confirm the fitted driver is `MCF8316DVRGFR`, or document the exact MCx83xx variant being tested.
- Confirm VM, buck, and logic rails match the board schematic and driver datasheet limits.
- Confirm the schematic includes the surrounding components and test pads listed in [Rev 3 Motor Driver](rev3-motor-driver.md), including VM bypass, charge-pump capacitors, AVDD/DVDD bypass, buck support parts, I2C/fault pullups, and phase-output test access.
- Confirm ESP32 and driver grounds are common.
- Confirm I2C pullups are fitted and SDA/SCL route to the ESP32 `Wire` bus used by firmware.
- Confirm `MOTOR_SPEED_PWM_PIN` routes to GPIO 19 only if this board intentionally keeps the bench PWM fallback test path.
- Confirm `MCF_DRVOFF_PIN` routes to GPIO 17 and can hold the driver outputs disabled.
- Confirm `MCF_NFAULT_PIN` routes to GPIO 26 with the expected active-low behavior.
- Confirm `MCF_FG_PIN` routes to GPIO 33 with a 3.3 V pullup and that FG pulses are visible on a scope or logic analyzer during bench motor tests.
- Confirm `MCF_I2C_ADDR` is still `0x01` unless the driver EEPROM has intentionally been programmed to another target ID.
- Confirm which speed-command path is fitted for this board revision. Default firmware uses the Rev 3 D-variant I2C speed command path and blocks nonzero motor command until the volatile command register readback is verified; PWM requires an explicit `OZEALIS_MCF8316D_I2C_SPEED=0` plus `OZEALIS_BENCH_PWM_SPEED_FALLBACK=1` bench build.
- Confirm test points are available for VM, logic rails, I2C, `DRVOFF`, `nFAULT`, `FG`, speed command, and phase outputs.

## 2. First Power

- Power the board from a current-limited bench supply with the blower disconnected or mechanically safe on a bench fixture.
- Keep `DRVOFF` asserted until VM and logic rails are stable.
- Verify there is no unexpected heating, smell, audible chatter, or supply current jump.
- Verify firmware VIN telemetry is plausible before enabling any motor command path.

## 3. Firmware Presence Check

- Boot the firmware and confirm the serial log reports the MCF8316D I2C target at `0x01` as present.
- Confirm the mobile app reports Driver I2C as Present and Driver fault as Clear.
- Confirm live CSV contains `motor_i2c=1`, `motor_fault=0`, and plausible `motor_fg_hz`; the live `motor_i2c` value comes from a periodic target probe so wiring or power fixes after boot are visible without reflashing. Start, calibration, and fault-clear gates still perform immediate readiness probes.
- Confirm fault CSV and session CSV headers include `motorI2c`, `motorFault`, and `motorFgHz`, and the retained session header ends with `sample_kind`.
- Read the MCF8316D parameter snapshot from the mobile app. A default build with verified I2C speed command must report `state=readback_valid`, `runtimeSpeed=i2c`, `targetSpeed=i2c`, `commandReady=true`, and `writesAllowed=false`; a failed command-register readback must stay blocked as `register_layer_pending` or otherwise not command-ready.
- If the driver was powered or repaired after boot, reread the MCF8316D snapshot while the blower is stopped; firmware retries a zero-speed command/readback only while idle with zero command and no driver fault, and should then recover to `commandReady=true` if the transaction is healthy.

## 4. Negative Tests

- Remove driver power or disconnect SDA/SCL, then verify I2C presence becomes missing.
- While I2C is missing, verify BLE start, mobile start, calibration start, and physical short-press start are rejected and enter `FAULT_IO`.
- Assert `nFAULT` low with the safest available board-level method, then verify firmware enters `FAULT_IO`, stops motor command, and records the fault.
- Confirm the motor command is removed before the audible alarm sequence begins on any induced fault.
- During a nonzero command in a bench fallback build, remove driver I2C or assert `nFAULT` and confirm the motor wrapper removes command and asserts `DRVOFF`.
- Send a BLE `stop` command while faulted and confirm the firmware remains in fault mode with motor output disabled.
- Send `{clearMotorFault:1}` while `nFAULT` is still asserted and confirm it fails.
- Release the underlying fault condition, restore I2C, send `{clearMotorFault:1}`, and confirm firmware writes the MCF8316D `CLR_FLT` bit, sees `nFAULT` deassert, revalidates command readiness, and returns to idle only after the driver is ready.

## 5. Command Path Check

- With the motor still disconnected or secured in a safe bench fixture, confirm default firmware refuses start/calibration while I2C speed-command readback is not verified.
- For an explicit bench build only, compile `esp32dev_bench_pwm`, which defines `OZEALIS_BENCH_PWM_SPEED_FALLBACK=1`, scope the speed-command signal on `MOTOR_SPEED_PWM_PIN`, and confirm nonzero driver command units produce the expected 25 kHz PWM on GPIO 19.
- For the D-variant I2C speed path, confirm every `ALGO_DEBUG1` speed-write transaction and readback rule has been validated on a bench fixture before any longer run.
- Confirm stop, fault, and calibration abort remove the command and leave the driver disabled path in the expected state.
- During a short calibration sweep, interrupt driver I2C or assert `nFAULT` and confirm the sweep aborts into `FAULT_IO` with motor command removed.
- Confirm `DRVOFF` follows the intended enable and disable sequence for the board revision.

## 6. Conservative Motor Test

- Connect the intended blower only after the no-motor electrical checks pass.
- Keep pressure tubing open to instruments, not to a person.
- Start with a low command limit and short dwell time.
- Watch supply current, driver temperature, board temperature, pressure, and audible behavior.
- Abort on unexpected heating, unstable startup, repeated faulting, pressure overshoot, or unusual vibration.

## 7. Calibration Sweep

- Before calibration, review the [MCF8316D Commissioning Contract](mcf8316d-commissioning.md) and retain the `0032` parameter snapshot export.
- Run the automatic motor calibration only after the conservative motor test is stable.
- For the water-column map, make a U with clear CPAP tubing, secure it vertically, fill it with water, keep the machine at least 5 cm above the water level, align a 20 cm or longer ruler zero mark to the resting waterline, then start at 4 cmH2O, let command rise slowly, capture with the physical button when the water column matches, and repeat through 20 cmH2O. The accepted no-flow captures also average and persist the blower-minus-mask differential sensor trim.
- Use independent pressure instrumentation and retain the raw instrument notes.
- Keep current and temperature limits conservative for the first sweep, even if it takes longer.
- Verify abort from the mobile app, BLE stop command, and physical button during the sweep.
- Confirm the session CSV contains 1 Hz rows from the active calibration sweep with exact `sample_kind=calibration`, retains up to 30 minutes before older rows roll off, and those rows remain exportable without appearing in mobile airflow analysis.
- Review the stored pressure curve before using it for any longer bench run.

## 8. Data To Keep

- Serial log from boot through the test.
- Live CSV excerpt showing `motor_i2c`, `motor_fault`, `motor_cmd`, `motor_fg_hz`, measured pressure, and setpoint.
- Session CSV from the calibration sweep and fault CSV from any induced fault.
- Supply voltage and current notes.
- Driver and board temperature notes.
- Exact motor, blower, driver part marking, board revision, firmware commit, and driver EEPROM configuration.
- MCF8316D parameter snapshot export from the mobile app, including the speed-command readback state and the still read-only parameter/EEPROM commissioning state.
- Any commissioning snapshot fields required by [MCF8316D Commissioning Contract](mcf8316d-commissioning.md) once register reads are implemented.

## References

- TI SLLA662, "How to Program I2C for MCx83xx Device Family"
- TI MCF8316D datasheet
