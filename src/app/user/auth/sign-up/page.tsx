"use client";

// import { FormEvent } from 'react'
import { Capitalize } from "@/lib/utils"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from 'next/navigation'

import { z, ZodType } from 'zod'

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"

{/* <Link href="/forgot-password" className="ml-auto inline-block text-sm underline">Forgot your password?</Link> */}

const nameSchema = z.string().min(2, { message: 'Name must contain at least two characters' }).max(24, {message: 'Name must be less than 24 characters'})
const emailSchema = z.string().min(1, 'Please enter an email').email({ message: 'Invalid email address'});

const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be greater than 8 characters' })
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => /[0-9]/.test(password), { message: 'Password must contain at least one number' })
  .refine((password) => /[!@#$%^&*-_]/.test(password), {
    message: 'Password must contain at least one special character (!@#$_%^&*-)',
  });

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function SignUp () {
  const router = useRouter();

  const formSchema: ZodType<FormData> = z.object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string()
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords must match one another", 
    path: ["confirmPassword"] 
  })

  const { register, handleSubmit, formState: {errors} } = useForm<FormData>({
    resolver: zodResolver(formSchema)
  })

  const submitData = async (data: FormData) => {
    const response = await fetch('/api/user/sign-up', {
      method: 'POST',
      headers: {contentType: 'application/json'},
      body: JSON.stringify({
        name: `${Capitalize(data.firstName)} ${Capitalize(data.lastName)}`,
        email: data.email,
        password: data.password
      })
    })

    const status = await response.status;

    switch (status) {
      case 201:
        router.push("/");
        break;
      case 409:
        // Find better way to display errors; maybe use a toast.
        alert("User already exists");
        break;
      case 500:
        alert("Server Error");
        break;
    }
  }

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
            <form className="grid gap-4" onSubmit={handleSubmit(submitData)}>
              <div className="flex gap-x-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" type="text" placeholder="John" required {...register("firstName")}/>
                  {errors.firstName && <span className="text-red-500 text-xs">{errors.firstName.message}</span>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" type="text" placeholder="Doe" required {...register("lastName")}/>
                  {errors.lastName && <span className="text-red-500 text-xs">{errors.lastName.message}</span>}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  required
                  {...register("email")}
                />
                {errors.email && <span className="text-red-500 text-xs">{errors.email.message}</span>}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input id="password" type="password" required {...register("password")}/>
                {errors.password && <span className="text-red-500 text-xs">{errors.password.message}</span>}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Re-enter Password</Label>
                </div>
                <Input id="confirmPassword" type="password" required {...register("confirmPassword")}/>
                {errors.confirmPassword && <span className="text-red-500 text-xs">{errors.confirmPassword.message}</span>}
              </div>
              <Button type="submit" className="w-full">Sign Up</Button>
              <span className="text-center text-sm text-gray-700">or</span>
              <Button variant="outline" className="w-full">Sign Up with Google</Button>
              <Button variant="outline" className="w-full">Sign Up with Facebook</Button>
            </form>
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
