// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#050505' }}>
        {children}
      </body>
    </html>
  )
}
