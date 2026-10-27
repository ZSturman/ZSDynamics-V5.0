# Content review — October 27, 2026

Items found while adding the professional presentation that need the owner's
confirmation or material. Nothing below was guessed into the live copy.

## Résumé and experience

1. **Public résumé is from April 2026.** `public/Zachary Sturman Resume.pdf` titles you
   "AI Software Engineer" and does not mention Seattle Central College. The site copy
   uses the brief's positioning and the current coursework. Consider replacing the PDF
   with a current general version (not an application-specific one).
2. **Removed from public experience: "Web Engineer, theKnifeGrinder (Aug 2020 – Nov 2023)".**
   It was in the unused site data but is not on the current résumé. Restore it in
   `lib/site-content.ts` only if it should be public.
3. **TowardBetter.me details differ.** Old site data listed FastAPI, an LLM chat
   assistant, Twilio, Stripe and Zoom under "Data Engineer (Contract)". The site now uses
   the résumé's "Full-Stack Software Engineer (Contract)" wording. Confirm which is correct.
4. **Engagement types.** The Wolf Project is labelled "Nonprofit web platform" and Lost &
   Hound "University of Melbourne collaboration", as on the résumé. Confirm whether either
   was paid employment, contract, or volunteer work.
5. **Ameristar overlap.** Business Intelligence Engineer (Apr 2017 – Oct 2023) and Casino
   Dealer (Apr 2017 – Present) share a start date at the same employer. Confirm the
   relationship (concurrent roles?) so the timeline reads correctly.
6. **Certification name and years.** The résumé says "Google Certified Data Analyst"; a
   newer résumé says "Google Data Analytics Certificate". The site uses the latter with
   years 2022 (Google) and 2023 (AWS) from earlier site data. Confirm names and years.
7. **Degree year.** B.S. Media Communication, Full Sail University, shown as 2014 (earlier
   site data and a recent résumé agree). Confirm.
8. **Seattle Central College.** Shown as "Mathematics coursework (in progress)". Add a
   program name or expected timeline if you want one shown.

## Photographs and media

9. **No real photo is used.** `public/Headshot.png` carries a Gemini watermark and appears
   AI-generated, so it is not shown anywhere new. To add a portrait or a photo of you
   working, place it in `public/` and add it to the About page (`app/about/page.tsx`
   marks the spot). Consider removing `Headshot.png` if it isn't a real photograph.
10. **Hue Light Control** media are technical illustrations. A photo of the built
    controller and a short demo video would be the strongest hardware evidence.
11. **Hardware category is thin (2 projects).** Workspace projects that could support it
    but are not published: Home Services (Raspberry Pi 5), Camera Monitor, Arduino
    Sensors. Publish only what you're comfortable making public; none were exposed.
12. Architecture diagrams or test-result captures for Better Workspace, Recallable,
    Transactions and Job Search Hub would strengthen their case studies.

## Equipment list

13. `/explore/hardware` lists equipment from your brief: ESP32, Raspberry Pi 5,
    PlatformIO, breadboards, soldering, multimeter, oscilloscope, 3D printing, sensors,
    cameras, rotary encoders, I2C OLED displays. Remove anything you'd rather not claim.

## Project records

14. **ChewSense** is labelled "Active development" (Notion status Active / phase
    Production) although it has an App Store listing. Update Notion if it should read
    Released.
15. **Selected Work ranking** lives only in `content/selected-work.json`. Review the six
    choices; Notion Featured flags are untouched (see `docs/setup/portfolio-presentation.md`).
16. **Hue Light Control case study** is drawn from its README and `docs/PORTFOLIO.md`.
    Firmware operation is described as builder-reported. Add measured results if you have
    any (e.g. response latency, uptime).
