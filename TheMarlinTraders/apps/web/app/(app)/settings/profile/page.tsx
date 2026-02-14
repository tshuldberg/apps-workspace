'use client'

import { useState } from 'react'
import { Button } from '@marlin/ui/primitives/button'
import { Input } from '@marlin/ui/primitives/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@marlin/ui/primitives/card'

export default function ProfileSettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Profile</h1>
        <p className="text-sm text-text-secondary">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Display Name</CardTitle>
          <CardDescription>Your public display name across the platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Button size="sm">Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>Your primary email address (managed by Clerk)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled
          />
          <p className="text-xs text-text-muted">
            Email is managed through your authentication provider.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-trading-red">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm">
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
