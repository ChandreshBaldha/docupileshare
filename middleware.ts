import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Role-based access: only SUPER_ADMIN and ADMIN can access /admin routes
    if (path.startsWith('/admin') && !['SUPER_ADMIN', 'ADMIN'].includes(token?.role as string)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname
        // Public paths that don't need auth
        if (path.startsWith('/share/') || path.startsWith('/api/share/link/')) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/folders/:path*',
    '/shares/:path*',
    '/admin/:path*',
    '/api/folders/:path*',
    '/api/files/:path*',
    '/api/csv/:path*',
    '/api/share/:path*',
    '/api/batch/:path*',
    '/api/upload/:path*',
    '/api/branding/:path*',
    '/api/templates/:path*',
    '/api/notifications/:path*',
    '/api/users/:path*',
  ],
}
