import { Card, CardContent, CardHeader, CardTitle, Button, Container } from '@suraksha/ui';

export default function AdminSignIn() {
  return (
    <section className="py-16">
      <Container className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Admin sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" action="/api/auth/magic-link" method="post">
              <label className="block">
                <span className="text-sm font-medium text-ink">Work email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="you@surakshasaathi.com"
                  required
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2"
                />
              </label>
              <Button type="submit" className="w-full" size="lg">
                Send magic link
              </Button>
              <p className="text-xs text-ink-subtle">
                Admin access is by invitation. If you don't have an account yet, talk to your admin.
              </p>
            </form>
          </CardContent>
        </Card>
      </Container>
    </section>
  );
}
