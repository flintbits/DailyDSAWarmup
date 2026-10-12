import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const repository = process.env.GITHUB_REPOSITORY?.split('/').at(-1)
const isUserSite =
  repository?.toLowerCase() === `${process.env.GITHUB_REPOSITORY_OWNER?.toLowerCase()}.github.io`

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' && repository && !isUserSite ? `/${repository}/` : '/',
  plugins: [react()],
})
