import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from "@tanstack/react-form";
import Input from '#/components/shared/Input';
import Button from '#/components/shared/Button';
import { TbBallFootball } from 'react-icons/tb'
import { useState } from 'react';
import { z } from "zod";

export const Route = createFileRoute('/auth/sign-in')({
  component: RouteComponent,
})

const signInSchema = z.object({
  phone: z
      .string("Phone number is required.")
      .transform((val) => val.startsWith('+') ? val : `+20${val}`)
      .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in the correct format.")),
  password: z
      .string("Password is required.")
      .min(1, "Password is required.")
      .max(100, "Password may not be longer than 100 characters."),
});

function RouteComponent() {
  const [isVisible, setIsVisible] = useState(false);

  const form = useForm({
    defaultValues: {
      phone: '',
      password: ''
    },
    validators: {
      onSubmit: signInSchema
    },
    onSubmit: async ({ value }) => {
      const payload = {
        ...value,
        phone: value.phone.startsWith('+') ? value.phone : `+20${value.phone}`,
      };

      console.log(payload);
    }
  });

  return (
    <div className='p-4 h-screen flex gap-x-4'>
      <div className='h-full w-2/5 bg-gray-50 rounded-md p-4'>

      </div>
      <div className='h-full flex-center relative w-3/5 bg-gray-50 rounded-md p-4 overflow-clip'>
        <TbBallFootball className='absolute -bottom-24 -right-24 size-96 text-primary-muted opacity-5 z-0'/>
        <Link to="/" className='absolute top-4 left-4'>
            <div className="flex-center size-10 rounded-md bg-primary">
                <TbBallFootball className="size-6.5" strokeWidth={2}/>
            </div>
        </Link>
        <form 
          className='w-sm'
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <div className='flex flex-col gap-y-2 mb-8'>
            <h1 className='text-3xl font-medium'>Sign In</h1>
            <p className='text-gray-500 text-base'>Don't have an account on Hagz yet? <Link to="/auth/sign-up" className='text-primary-muted hover:underline'>Sign up</Link></p>
          </div>
          <div className='flex flex-col gap-y-4'>
            <form.Field
              name="phone"
              children={(field) => {
                return (
                  <Input 
                    label="Phone"
                    placeholder="Phone Number" 
                    value={field.state.value} 
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="phone"
                    error={field.state.meta.errors[0]?.message}
                  />
                )
              }}
            />
            <form.Field
              name="password"
              children={(field) => {
                return (
                  <div className='flex flex-col gap-y-4'> 
                    <Input 
                      label="Password"
                      placeholder="Password" 
                      value={field.state.value} 
                      onChange={(e) => field.handleChange(e.target.value)}
                      type={isVisible ? "text" : "password"}
                      error={field.state.meta.errors[0]?.message}
                    />
                    <div className='flex items-center justify-between gap-x-16'>
                      <div className='flex items-center gap-x-1.5'>
                        <input type="checkbox" className='accent-primary-muted' checked={isVisible} onChange={() => setIsVisible(v => !v)}/>
                        <span className='text-sm'>Show password</span>
                      </div>
                      <Link to="/auth/reset/send" className='text-sm text-primary-muted hover:underline'>Forgot password?</Link>
                    </div>
                  </div>
                )
              }}
            />
            <Button type="submit" className='mx-auto bg-primary hover:bg-primary/75 mt-4'>
              <span className='text-base font-medium'>Sign in</span>
            </Button>
          </div>
        </form>
        <span className='text-gray-500 absolute bottom-4 text-xs'>© Hagz 2026. All rights reserved.</span>
      </div>
    </div>
  )
}
