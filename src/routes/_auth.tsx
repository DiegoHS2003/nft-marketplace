import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCurrentUser } from '@/lib/auth'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    const user = await getCurrentUser(context.queryClient)
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: () => <Outlet />,
})