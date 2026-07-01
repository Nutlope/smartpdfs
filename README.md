<a href="https://github.com/Nutlope/smartpdfs">
  <img alt="SmartPDF" src="./public/og.jpg">
  <h1 align="center">SmartPDF</h1>
</a>

<p align="center">
  Instantly summarize and section your PDFs with AI. Powered by Llama 3.3 on Together AI.
</p>

## Tech stack

- [Together AI](https://togetherai.link/?utm_source=smartpdfs&utm_medium=referral&utm_campaign=example-app) for inference
- [Llama 3.3](https://togetherai.link/llama-3.3) for the LLM
- Next.js with Tailwind & TypeScript
- Prisma ORM with Neon (Postgres)
- Helicone for observability
- Plausible for analytics
- S3 for PDF storage

## Cloning & running

1. Clone the repo: `git clone https://github.com/Nutlope/smartpdfs`
2. Create a `.env` file and add your environment variables (see `.example.env`):
   - `TOGETHER_API_KEY=`
   - `DATABASE_URL=`
   - `S3_UPLOAD_KEY=`
   - `S3_UPLOAD_SECRET=`
   - `S3_UPLOAD_BUCKET=`
   - `S3_UPLOAD_REGION=us-east-1`
   - `HELICONE_API_KEY=` (optional, for observability)
3. Run `pnpm install` to install dependencies
4. Run `pnpm prisma generate` to generate the Prisma client
5. Run `pnpm dev` to start the development server

## Roadmap

- [ ] Add some rate limiting by IP address
- [ ] Integrate OCR for image parsing in PDFs
- [ ] Add a bit more polish (make the link icon nicer) & add a "powered by Together" sign
- [ ] Implement additional revision steps for improved summaries
- [ ] Add a demo PDF for new users to be able to see it in action
- [ ] Add feedback system with thumbs up/down feature
