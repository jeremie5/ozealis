# Safety and Scope

Ozealis is not a medical device. It has not been reviewed or approved by the FDA, Health Canada, EU MDR authorities, or any other regulator.

Ozealis is an experimental airflow simulation and research platform for education, personal study, prototyping, and open collaboration. It is provided as-is, with all faults, and without warranties or claims.

## Hard boundaries

Do not use Ozealis as:

- A substitute for professional medical care.
- A device for diagnosis, treatment, cure, mitigation, or prevention of sleep apnea or any other condition.
- Emergency, life-support, or unattended safety-critical equipment.
- A basis for commercial medical services or regulated medical deployment without independent professional engineering, clinical, legal, and regulatory review.

## Risk ownership

Anyone who builds, modifies, tests, or operates these files is responsible for:

- Validating electrical, thermal, mechanical, firmware, and airflow behavior.
- Verifying sensor accuracy and failure modes.
- Ensuring hygienic material selection and cleaning procedures.
- Understanding local laws and regulations.
- Supervising experiments and stopping immediately when behavior is unexpected.

## Shortage or disaster context

The project is built with awareness that equipment shortages can happen. That does not make Ozealis approved equipment or a substitute for regulated devices. Any shortage-driven study, institutional evaluation, or adaptation needs independent professional engineering, clinical, legal, infection-control, and regulatory review before anyone relies on it.

Design choices should assume that mistakes can cause harm: fail closed, keep pressure and motor limits conservative, preserve logs, make faults visible, and prefer measured evidence over optimistic assumptions. Public documentation must stay honest about the experimental scope even when internal engineering aims for high rigor.

## Minimum experimental precautions

- Test with instrumentation before any human exposure.
- Use current-limited power during bring-up.
- Verify overpressure, undervoltage, sensor, motor-driver, and power-loss fault behavior.
- Keep logs and fault snapshots for every test session.
- Treat firmware settings as experimental tuning inputs, not prescriptions.
- Never share settings as medical advice or present airflow observations as screening results.

## Documentation language

Preferred wording:

- "experimental airflow simulator"
- "research platform"
- "telemetry"
- "settings"
- "pressure target"
- "fault handling"

Avoid wording that implies medical approval or performance:

- "treats sleep apnea"
- "therapy guaranteed"
- "therapeutic"
- "safe for use"
- "safe and effective"
- "clinically validated"
- "compliant"
- "production ready"
- "ready for patients"
- "patient ready"
- "ready for clinical use"
- "sleep apnea treatment"
- "sleep apnea screening"
- "screening tool"
- "prescription"
- "prescribed setting"
- "emergency use"
- "life support"
