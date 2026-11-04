# JALgorithm - ML-Based Appointment Chatbot

**A MACHINE LEARNING-BASED CHATBOT FOR AUTOMATED APPOINTMENT BOOKING AND REMINDERS**

By
**June Vic M. Abello**
**Lorraine R. Azucenas**
**Alan Jr. P. Ecalnir**

Bachelor of Science in Computer Science
Olongapo City, Philippines

---

A machine learning-based chatbot for automated appointment booking and reminders for small hair and makeup salons.

## Stack

- **Frontend:** React + Vite + Tailwind CSS v4
- **Backend/DB:** Supabase (PostgreSQL + Auth + Edge Functions)
- **AI:** LM Studio (local LLM via OpenAI-compatible API)
- **Hosting:** Vercel

## Setup

### 1. Clone and install

```bash
git clone https://github.com/EcomineAI/jalgorithm-chatbot.git
cd jalgorithm-chatbot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your values in `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_LM_STUDIO_URL=http://localhost:1234
```

### 3. Set up Supabase

- Create a project at [supabase.com](https://supabase.com)
- Run `supabase/schema.sql` in the Supabase SQL editor
- Copy your project URL and anon key into `.env.local`

### 4. Start LM Studio

- Open LM Studio and load a model (LLaMA, Mistral, or Gemma)
- Start the local server (default: `http://localhost:1234`)
- For thesis demo with Vercel, use [ngrok](https://ngrok.com) to expose the local server:
  ```bash
  ngrok http 1234
  ```
  Then update `VITE_LM_STUDIO_URL` with the ngrok URL.

### 5. Run dev server

```bash
npm run dev
```

## Pages

| Route | Description |
|---|---|
| `/` | Landing page (public) |
| `/chat` | Client chatbot interface |
| `/admin/login` | Stylist login |
| `/admin` | Admin dashboard (appointments, chat logs, reminders) |

## Evaluation Targets

| Metric | Target |
|---|---|
| Intent-recognition accuracy | >= 85% |
| Booking completion rate | >= 90% |
| Reminder delivery rate | >= 95% |
| Response time | <= 3 seconds |
