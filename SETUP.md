# Docupile Share — Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (for BullMQ job queue)
- AWS S3 bucket OR MinIO (self-hosted)
- Email: Resend API key OR SMTP server
- Twilio account (for SMS OTP)

---

## Step 1 — Clone & Install

```bash
npm install
```

---

## Step 2 — Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

**Minimum required:**
```
DATABASE_URL=postgresql://user:pass@localhost:5432/docupile_share
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=http://localhost:3000
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=docupile-share
AWS_REGION=us-east-1
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
```

---

## Step 3 — Database Setup

### Option A: Run the SQL script directly
Connect to your PostgreSQL database and run:

```bash
psql -U your_user -d your_database -f database/schema.sql
```

### Option B: Use Prisma migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

---

## Step 4 — Run the Application

### Development (two terminals)

**Terminal 1 — Next.js:**
```bash
npm run dev
```

**Terminal 2 — Email worker (requires Redis):**
```bash
npm run worker
```

---

## Step 5 — First Login

Default admin credentials (created by the SQL seed):
- **Email:** `admin@docupile.com`
- **Password:** `Admin@123`

> **Change the password immediately after first login.**

---

## Step 6 — Production Deployment

```bash
npm run build
npm run start
```

For the worker in production, use PM2 or a systemd service:
```bash
pm2 start "npm run worker" --name "docupile-worker"
```

---

## Application Workflow

```
1. Create Folder
   └─ 2. Upload PDF Files (bulk, up to 1300+)
         └─ 3. Upload CSV (name, email, phone columns)
               └─ 4. Auto-match CSV recipients → PDF files
                     └─ 5. Configure Share:
                           • Email template with {{variables}}
                           • Custom branding logo
                           • OTP settings (email/phone)
                           • Link expiry duration
                           └─ 6. Send Bulk (background queue)
                                 └─ 7. Monitor progress + Download Excel log
```

---

## CSV Format

Required columns: `name`, `email`
Optional: `phone`, and any extra columns (stored in extra_data)

```csv
name,email,phone,department
John Doe,john@example.com,+1234567890,Engineering
Jane Smith,jane@example.com,,Marketing
```

Column names are auto-detected (case-insensitive). Aliases supported:
- name: `name`, `full_name`, `fullname`, `recipient_name`, `student_name`
- email: `email`, `email_address`, `emailaddress`, `mail`
- phone: `phone`, `phone_number`, `mobile`, `contact`, `cell`

---

## MinIO Setup (Self-hosted S3)

```env
AWS_S3_ENDPOINT=http://localhost:9000
AWS_S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_S3_BUCKET=docupile-share
AWS_REGION=us-east-1
```

---

## Architecture

```
Browser → Next.js App (API Routes)
                ↓
         PostgreSQL (Prisma)
                ↓
         S3/MinIO (Files)
                ↓
         Redis + BullMQ (Email queue)
                ↓
         Resend/SMTP (Email delivery)
         Twilio (SMS OTP)
```
