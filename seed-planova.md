# Seed Planova Data

## Goal
Automate the seeding of Planova S/A client records (D1) and local deliverables & uploads (R2) in the local development environment.

## Tasks
- [x] Task 1: Create `scripts/seed-planova.js` to execute wrangler D1 migrations and seed.sql → Verify: File created successfully.
- [x] Task 2: Implement local R2 deliverable uploads (`dossie_victor_penzo.html`, `apresentacao_osint.html`, `grafo_victor_penzo.html`) in `seed-planova.js` → Verify: Objects uploaded to wrangler local R2 bucket.
- [x] Task 3: Implement search for local PDFs in `../Planova` and seed them as client uploads in D1 and R2 → Verify: Uploads records created in D1 and files copied to R2.
- [x] Task 4: Add `"db:seed:planova": "node scripts/seed-planova.js"` script to `package.json` → Verify: Run script, verify D1 execution and R2 bucket population.

## Done When
- [x] Running `npm run db:seed:planova` populates local D1 and local R2 with Planova client files.
- [x] The local dev portal shows all Planova documents available for download.
