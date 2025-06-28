# Ozealis – The $75 Experimental CPAP Simulator

> ⚠️ **NOT A MEDICAL DEVICE.** Experimental use only.  
> **→ See full legal disclaimer below.**

---

## 💡 What Is Ozealis?

Ozealis is a fully open-source, modular platform for exploring low-cost, user-driven air-pressure systems. It was created by necessity — for those of us who can’t afford to wait for diagnosis, approval, or overpriced medical devices.

This project is not a product, nor a substitute for professional care. It is a tool for personal experimentation, educational insight, and collaborative innovation.

Because sleep should be safe, and safety should be accessible.

---

## 🔧 Features

- ✅ PTC fuse protection on all power paths  
- ✅ Reverse polarity protection via MOSFET (no diode drop)  
- ✅ Power outage alarm via buzzer and capacitor-based UPS  
- ✅ DC5525 input (14V–35V) — compatible with laptop bricks & power stations  
- ✅ Differential pressure sensing via physical baffle (not RPM guesswork)  
- ✅ Pre/Post humidity & temperature sensing  
- ✅ Modular accessory port (USB-A + I²C) for:
  - Heated hose module  
  - Humidifier module  
- ✅ App-controlled via WiFi + Bluetooth  
- ✅ 16MB onboard log memory  
- ✅ Compatible with $6 standard CPAP hoses  
- ✅ No proprietary parts, no DRM  
- ✅ Fully 3D-printable enclosure with FDM-optimized geometry  

---

## 📷 Photos & Demos

Coming soon. This section will include:

- High-resolution photos  
- Assembly walk-throughs  
- App UI screenshots  
- Demo video showing pressure response & noise levels  

---

## 📦 Getting Started

### 🛠️ Build It Yourself

**Documentation coming soon.** For now, refer to:

- `hardware/` – Schematics, PCB layout, and BoM  
- `firmware/` – ESP32 firmware and config  
- `case/` – STL and STEP files for enclosure (PC + TPU)

Assembly requires:

- Basic soldering skills  
- A 3D printer with 0.4–0.6 mm nozzle  

---

## 📱 App & Data Logging

- Connect via WiFi to view real-time pressure graphs  
- Export logs in JSON or CSV  
- Tune pressure ramp profiles & buzzer thresholds  
- OTA firmware updates planned  

---

## 🛡️ Safety Systems

Ozealis includes multiple built-in protections:

- 🧯 Overcurrent protection on all input/output rails  
- 🔔 Power-loss alarm wakes user with buzzer  
- 🌡️ Thermal cutoff disables output at unsafe temps  
- 💨 Airflow anomaly detection via differential pressure monitoring  

> This level of visibility is **absent in many commercial machines**.

---

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

Commercial use (manufacturing, distribution, resale) requires a separate license.  
**Contact:** `team@ozealis.org`

See `LICENSE.md` for full terms.

---

## 🚫 Not a Medical Device

Ozealis is **not approved** by Health Canada, the FDA, or any regulatory agency.  
It is an airflow simulation platform intended for **research and experimental purposes only**.

> No claims are made regarding the treatment, cure, or prevention of sleep apnea or any other condition.

---

## 🤝 Contribute

Pull requests welcome! Areas to contribute:

- App UI & UX polish  
- Log export improvements  
- Pressure tuning curves  
- Testing with accessories (heated hoses, passive humidifiers)  

Fork → improve → PR 💜

---

## 🗺️ Roadmap

- ✅ Full BoM and build guide  
- ✅ App-based tuning UI  
- ✅ Web configurator for real-time control  
- 🎥 YouTube demo + sound comparison  
- 🌍 Translations (FR, EN, ES)

---

**CRITICAL DISCLAIMER — READ BEFORE BUILDING OR USING OZEALIS**  
>   
> 1. **No Medical Device.** Ozealis has **NOT** been reviewed or approved by any
>    regulatory body (FDA, Health Canada, EU MDR, etc.). It is an
>    **experimental air-pressure simulator** provided solely for research,
>    educational and personal *non-commercial* use.  
> 2. **No Professional Advice.** All documentation is for informational
>    purposes only and does **not** constitute medical, engineering, or legal
>    advice. Consult qualified professionals before any practical use.  
> 3. **AS-IS, NO WARRANTIES.** The files, firmware and hardware designs are
>    provided **“AS IS,” WITH ALL FAULTS, WITHOUT WARRANTIES** of any kind,
>    express or implied, including but not limited to merchantability,
>    fitness for a particular purpose and non-infringement.  
> 4. **Assumption of Risk.** You assume **all risks** arising from loading,
>    building, testing or using Ozealis. You are responsible for validating
>    safety, performance and regulatory compliance of any assembly.  
> 5. **Indemnity.** To the maximum extent permitted by law, you **agree to
>    indemnify and hold harmless** Shopiro Ltd. and contributors from any
>    claim, liability or expense (including legal fees) arising from your
>    use, reproduction, or distribution of these materials.  
> 6. **Limitation of Liability.** In no event shall Shopiro Ltd. or
>    contributors be liable for **any indirect, special, incidental or
>    consequential damages** (including personal injury or death) or for an
>    amount exceeding **USD 10**, even if advised of the possibility.  
> 7. **Governing Law & Venue.** These terms are governed by the laws of
>    Québec, Canada, and you consent to exclusive jurisdiction of its courts.  
>
> **By cloning, downloading, or using any part of this repository you
> acknowledge that you have read, understand, and agree to ALL of the above.**

---

Made with urgency, necessity, and care in Canada 🇨🇦  
Because breathing shouldn't require a credit check.

**Ozealis™ is a trademark of Shopiro Ltd.**
