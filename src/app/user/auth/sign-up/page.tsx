import Image from "next/image"
import Link from "next/link"

import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"

{/* <Link href="/forgot-password" className="ml-auto inline-block text-sm underline">Forgot your password?</Link> */}

export default function SignUp () {
  return (
    <div className="h-screen flex-center">
      <div className="w-full h-full lg:grid lg:grid-cols-3">
        <div className="flex-center py-12 col-span-2">
          <div className="mx-auto grid w-[350px] gap-6">
            <div className="grid gap-2 text-center">
              <h1 className="text-3xl font-bold">Sign Up</h1>
              <p className="text-sm text-muted-foreground my-2 text-gray-700">
                Enter your email below to create an account with Hagz
              </p>
            </div>
            <div className="grid gap-4">
              <div className="flex gap-x-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" type="text" placeholder="John" required/>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" type="text" placeholder="Doe" required/>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input id="password" type="password" required/>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Re-enter Password</Label>
                </div>
                <Input id="repassword" type="password" required/>
              </div>
              <Button type="submit" className="w-full">Login</Button>
              <Button variant="outline" className="w-full">Sign Up with Google</Button>
              <Button variant="outline" className="w-full">Sign Up with Facebook</Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account? &nbsp;
              <Link href="/user/auth/sign-in" className="underline">Sign in</Link>
            </div>
          </div>
        </div>
        <div className="hidden bg-muted lg:block col-span-1">
          <Image
            src="/placeholder.svg"
            alt="Image"
            width="1920"
            height="1080"
            className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </div>
    </div>
  )
}