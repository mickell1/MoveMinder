import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null

  // If an authenticated user requests the onboarding page, validate their profile.
  // If their profile is already complete we'll redirect them to the dashboard;
  // otherwise allow the onboarding page to load.
  if (user && request.nextUrl.pathname.startsWith('/onboarding')) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('fitness_level, goals')
      .eq('id', user.id)
      .single()

    if (!error && profile) {
      const fitnessLevel = profile.fitness_level
      const rawGoals = profile.goals

      let hasGoals = false
      if (Array.isArray(rawGoals)) {
        hasGoals = rawGoals.length > 0
      } else if (typeof rawGoals === 'string') {
        try {
          const parsed = JSON.parse(rawGoals)
          if (Array.isArray(parsed)) hasGoals = parsed.length > 0
          else if (typeof parsed === 'string') hasGoals = parsed.trim().length > 0
          else hasGoals = !!parsed
        } catch {
          hasGoals = rawGoals.trim().length > 0
        }
      } else {
        hasGoals = !!rawGoals
      }

      const hasFitness = !!fitnessLevel

      if (hasFitness && hasGoals) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // profile not complete or error reading it — allow onboarding page
    return response
  }

  // If not logged in and trying to access protected routes
  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/signup') && request.nextUrl.pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If logged in, check if profile is complete
  if (user && !request.nextUrl.pathname.startsWith('/onboarding')) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('fitness_level, goals')
      .eq('id', user.id)
      .single()

    // If there was an error reading the profile, don't block navigation here
    if (!error && profile) {
      const fitnessLevel = profile.fitness_level
      const rawGoals = profile.goals

      let hasGoals = false
      if (Array.isArray(rawGoals)) {
        hasGoals = rawGoals.length > 0
      } else if (typeof rawGoals === 'string') {
        // goals might be a JSON string or plain string
        try {
          const parsed = JSON.parse(rawGoals)
          if (Array.isArray(parsed)) hasGoals = parsed.length > 0
          else if (typeof parsed === 'string') hasGoals = parsed.trim().length > 0
          else hasGoals = !!parsed
        } catch (e) {
          hasGoals = rawGoals.trim().length > 0
        }
      } else {
        hasGoals = !!rawGoals
      }

      const hasFitness = !!fitnessLevel

      // optional bypass for debugging (set SKIP_ONBOARDING_REDIRECT=1 in env)
      if (process.env.SKIP_ONBOARDING_REDIRECT === '1') {
        return response
      }

      if (!hasFitness || !hasGoals) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
  }

  // If logged in and on login/signup page, redirect to dashboard
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('fitness_level, goals')
      .eq('id', user.id)
      .single()

    if (!error && profile) {
      const fitnessLevel = profile.fitness_level
      const rawGoals = profile.goals

      let hasGoals = false
      if (Array.isArray(rawGoals)) {
        hasGoals = rawGoals.length > 0
      } else if (typeof rawGoals === 'string') {
        try {
          const parsed = JSON.parse(rawGoals)
          if (Array.isArray(parsed)) hasGoals = parsed.length > 0
          else if (typeof parsed === 'string') hasGoals = parsed.trim().length > 0
          else hasGoals = !!parsed
        } catch (e) {
          hasGoals = rawGoals.trim().length > 0
        }
      } else {
        hasGoals = !!rawGoals
      }

      const hasFitness = !!fitnessLevel

      if (hasFitness && hasGoals) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      } else {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}