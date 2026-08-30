import type { ReactElement } from 'react'

const svg = (content: ReactElement) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    {content}
  </svg>
)

export const icons = {
  back: svg(
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  ),
  close: svg(
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  ),
  more: svg(
    <>
      <circle cx="5" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" />
    </>,
  ),
  ring: svg(
    <>
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
    </>,
  ),
  clipboard: svg(
    <>
      <path
        d="M9 5.5h6a1 1 0 0 1 1 1V8h1.2A1.8 1.8 0 0 1 19 9.8v8.7A1.8 1.8 0 0 1 17.2 20H6.8A1.8 1.8 0 0 1 5 18.2V9.8A1.8 1.8 0 0 1 6.8 8H8V6.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6.9c0-.5.4-.9.9-.9h4.2c.5 0 .9.4.9.9V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>,
  ),
  user: svg(
    <>
      <path d="M20 20a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="8.3" r="3.1" stroke="currentColor" strokeWidth="1.7" />
    </>,
  ),
}
