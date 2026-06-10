import AreaAccordion from '#/components/app/AreaAccordion';
import Button from '#/components/shared/Button';
import Dropdown from '#/components/shared/Dropdown';
import MultiDropdown from '#/components/shared/MultiDropdown';
import { NotificationChannel, type Language } from '#/lib/types/user';
import type { GroundSize, GroundSport } from '#/lib/types/venue';
import { useForm, useStore } from '@tanstack/react-form';
import { createFileRoute, Link } from '@tanstack/react-router';
import { TbBrandWhatsapp, TbMail, TbNotification, TbUser, TbUsers } from 'react-icons/tb';

export const Route = createFileRoute('/_app/account/settings')({
  component: RouteComponent,
});

function RouteComponent() {
  const { user, locations } = Route.useRouteContext();
  
  const governorates = locations.map(group => ({ value: group.id, label: group.name, options: group.areas.map(item => ({ label: item.name, value: item.id }))}));

  const initial = {
    language: user.preferences.language,
    timezone: user.preferences.timezone,
    role: user.preferences.role,
    sizes: user.preferences.sizes,
    sports: user.preferences.sports,
    area: user.preferences.area ?? null,
    notifications: user.preferences.notifications
  };

  const form = useForm({
    defaultValues: initial
  });

  const values = useStore(form.store, (s) => s.values);
  const isChanged = JSON.stringify(values) !== JSON.stringify(initial);

  return (
      <main className='px-4 py-10 w-full'>
        <div className='flex flex-col gap-y-px mt-2 mb-6'>
          <h1 className='text-lg font-medium'>Settings</h1>
          <span className='text-gray-500 text-sm'>Update your default search options, language, and notification preferences.</span>
        </div>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className='flex flex-col gap-y-6 w-full'
        >
          <section className='border-t border-gray-200 pt-6 w-full'>
            <div className='flex flex-col mb-4'>
              <h1 className='font-medium'>General</h1>
              <p className='text-gray-500 text-sm'>Change the default language, timezone, or transfer account type.</p>
            </div>
            <div className='flex gap-x-12 py-8'>
              <div className="w-1/3 flex flex-col">
                <h2 className='text-base font-medium'>Role</h2>
                <p className='text-sm text-gray-500'>Transfer your account to a user or owner account.</p>
              </div>
              <div className="w-2/3 flex items-stretch gap-x-4">
                <form.Field
                  name="role"
                  children={(field) => {
                    const isOwner = field.state.value === "OWNER";

                    return (
                      <>
                        <div onClick={() => field.handleChange("USER")} className={`w-60 h-fit cursor-pointer relative p-4 rounded-md bg-linear-to-br from-gray-100 to-white border ${!isOwner ? "border-primary-muted" : "border-gray-200"}`}>
                          <div className='flex flex-col gap-y-0.5'>
                            <div className='size-8 rounded-md border border-gray-200 flex-center mb-2.5 bg-white'>
                              <TbUser/>
                            </div>
                            <span className='font-medium text-sm'>I am a user</span>
                            <p className='text-xs text-gray-500'>I want to find pitches around me and book.</p>
                          </div>
                          <input type="radio" readOnly checked={!isOwner} className='absolute top-4 right-4 accent-primary-muted'/>
                        </div>
                        <div onClick={() => field.handleChange("OWNER")} className={`w-60 h-fit cursor-pointer relative p-4 rounded-md bg-linear-to-br from-gray-100 to-white border ${isOwner ? "border-primary-muted" : "border-gray-200"}`}>
                          <div className='flex flex-col gap-y-0.5'>
                            <div className='size-8 rounded-md border border-gray-200 flex-center mb-2.5 bg-white'>
                              <TbUsers/>
                            </div>
                            <span className='font-medium text-sm'>I am an owner</span>
                            <p className='text-xs text-gray-500'>I want to manage my venue and accept bookings.</p>
                          </div>
                          <input type="radio" readOnly checked={isOwner} className='absolute top-4 right-4 accent-primary-muted'/>
                        </div>
                      </>
                    )
                  }}
                />
              </div>
            </div>
            <div className='flex gap-x-12 py-8'>
              <div className="w-1/3 flex flex-col">
                <h2 className='text-base font-medium'>Language</h2>
                <p className='text-sm text-gray-500'>Default language for the application.</p>
              </div>
              <div className="w-2/3 flex items-center gap-x-4">
                <form.Field
                  name="language"
                  children={(field) => {
                    return (
                      <Dropdown 
                        options={[{ label: "English", value: "EN" }, { label: "عربي", value: "AR" }]} 
                        value={field.state.value} 
                        onChange={(value) => field.handleChange(value as Language)} 
                        className='w-64'
                      />
                    )
                  }}
                />
              </div>
            </div>
            <div className='flex gap-x-12 py-8'>
              <div className="w-1/3 flex flex-col">
                <h2 className='text-base font-medium'>Timezone</h2>
                <p className='text-sm text-gray-500'>Default timezone for your locale.</p>
              </div>
              <div className="w-2/3 flex gap-x-4">
                <form.Field
                  name="timezone"
                  children={(field) => {
                    return (
                      <Dropdown 
                        options={[{ label: "Cairo (UTC+3)", value: "Africa/Cairo" }]} 
                        value={field.state.value} 
                        onChange={(value) => field.handleChange(value)} 
                        className='w-64'
                      />
                    )
                  }}
                />
              </div>
            </div>
          </section>
          <section className='border-t border-gray-200 pt-6 w-full'>
            <div className='flex flex-col mt-2 mb-4'>
              <h1 className='font-medium'>Search Preferences</h1>
              <p className='text-gray-500 text-sm'>Change the default venue search filters for your account.</p>
            </div>
            <div className='flex gap-x-12 py-8'>
              <div className="w-1/3 flex flex-col">
                <h2 className='text-base font-medium'>Sports</h2>
                <p className='text-sm text-gray-500'>Select your preferred sports to look for by default when searching for venues.</p>
              </div>
              <div className="w-2/3">
                <form.Field
                  name="sports"
                  children={(field) => {
                    return (
                      <MultiDropdown 
                        options={[
                          { value: "FOOTBALL", label: "Football" },
                          { value: "BASKETBALL", label: "Basketball" },
                          { value: "VOLLEYBALL", label: "Volleyball" },
                          { value: "TENNIS", label: "Tennis" },
                          { value: "PADEL", label: "Padel" },
                        ]} 
                        placeholder='Select sports'
                        value={field.state.value} 
                        onChange={(value) => {
                            const updated = value as GroundSport[];
                            const sizes = form.getFieldValue("sizes");

                            if (sizes.length > 0 && !updated.includes("FOOTBALL")) return;

                            field.handleChange(updated);
                        }}
                        className='max-w-sm'
                      />
                    )
                  }}
                />
              </div>
            </div>
            <div className='flex gap-x-12 py-8'>
              <div className="w-1/3 flex flex-col">
                <h2 className='text-base font-medium'>Venue Size</h2>
                <p className='text-sm text-gray-500 mb-2'>Select your preferred pitch sizes to look for by default when searching for venues.</p>
                <p className='text-gray-500 text-sm mt-6'>Choosing a ground size automatically adds football to your list of preferred sports.</p>
              </div>
              <div className="w-2/3">
                <form.Field
                  name="sizes"
                  children={(field) => {
                    return (
                      <MultiDropdown 
                        options={[
                          { value: "FIVE_A_SIDE", label: "Five-a-side" },
                          { value: "SEVEN_A_SIDE", label: "Seven-a-side" },
                          { value: "ELEVEN_A_SIDE", label: "Eleven-a-side" },
                        ]} 
                        placeholder='Select sizes'
                        value={field.state.value} 
                        onChange={(value) => {
                          const sizes = value as GroundSize[];
                          field.handleChange(sizes);

                          if (sizes.length > 0) {
                            const sports = form.getFieldValue("sports");

                            if (!sports.includes("FOOTBALL")) {
                              form.setFieldValue("sports", [...sports, "FOOTBALL"]);
                            };
                          };
                        }}
                        className='max-w-sm'
                      />
                    )
                  }}
                />
              </div>
            </div>
            <div className='flex gap-x-12 py-8'>
              <div className="w-1/3 flex flex-col">
                <h2 className='text-base font-medium'>Area</h2>
                <p className='text-sm text-gray-500'>Select default area to look for venues at based on your governorate and district.</p>
              </div>
              <div className="w-2/3 flex flex-col gap-y-2">
                <form.Field
                  name="area"
                  children={(field) => (
                    <AreaAccordion
                      groups={governorates}
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                    />
                  )}
                />
              </div>
            </div>
          </section>
          <section className='border-t border-gray-200 pt-6 w-full'>
            <div className='flex flex-col mt-2 mb-4'>
              <h1 className='font-medium'>Notifications</h1>
              <p className='text-gray-500 text-sm'>Control the way you recieve notifications from Hagz.</p>
            </div>
            <div className='flex gap-x-12 py-8'>
              <div className="w-1/3 flex flex-col">
                <h2 className='text-base font-medium'>Channels</h2>
                <p className='text-sm text-gray-500'>Choose the platforms you want to recieve notifications on.</p>
                {
                  !user.email &&
                  <p className='text-gray-500 text-sm mt-6'>You still don't have an email associated with your account. <Link to="/account" className='text-primary-muted hover:underline'>Add one</Link> now to recieve notifications.</p>
                }
              </div>
              <div className="w-2/3 flex gap-x-4 flex-wrap gap-y-3">
                <form.Field 
                  name="notifications"
                  children={(field) => {
                    return (
                        <>
                          <div 
                            className={`h-fit cursor-pointer flex items-center justify-between bg-linear-to-br from-gray-100 to-white border px-3.5 py-2.5 rounded-md gap-x-10 w-fit ${field.state.value.includes(NotificationChannel.WHATSAPP) ? "border-primary-muted" : "border-gray-200"}`}
                            onClick={() => {
                              const current = field.state.value;

                              const next = current.includes(NotificationChannel.WHATSAPP)
                                ? current.filter(c => c !== NotificationChannel.WHATSAPP)
                                : [...current, NotificationChannel.WHATSAPP];

                              field.handleChange(next);
                            }}
                          >
                            <div className='flex items-center gap-x-2'>
                              <div className='flex-center size-8 border border-gray-200 rounded-md bg-white'>
                                <TbBrandWhatsapp className='size-5'/>  
                              </div>
                              <div className='flex flex-col max-w-32'>
                                <span className='text-[0.825rem] font-medium'>WhatsApp</span>
                              </div>
                            </div>
                            <input type="radio" readOnly checked={field.state.value.includes(NotificationChannel.WHATSAPP)} className='accent-primary-muted'/>
                          </div>
                          <div 
                            className={`h-fit cursor-pointer flex items-center justify-between bg-linear-to-br from-gray-100 to-white border px-3.5 py-2.5 rounded-md gap-x-10 w-fit ${field.state.value.includes(NotificationChannel.IN_APP) ? "border-primary-muted" : "border-gray-200"}`}
                            onClick={() => {
                              const current = field.state.value;

                              const next = current.includes(NotificationChannel.IN_APP)
                                ? current.filter(c => c !== NotificationChannel.IN_APP)
                                : [...current, NotificationChannel.IN_APP];

                              field.handleChange(next);
                            }}
                          >
                            <div className='flex items-center gap-x-2'>
                              <div className='flex-center size-8 border border-gray-200 rounded-md bg-white'>
                                <TbNotification className='size-5'/>  
                              </div>
                              <div className='flex flex-col max-w-32'>
                                <span className='text-[0.825rem] font-medium'>In-App</span>
                              </div>
                            </div>
                            <input type="radio" readOnly checked={field.state.value.includes(NotificationChannel.IN_APP)} className='accent-primary-muted'/>
                          </div>
                          <div 
                            className={`h-fit flex items-center justify-between bg-linear-to-br from-gray-100 to-white border px-3.5 py-2.5 rounded-md gap-x-10 w-fit ${user.email ? "cursor-pointer" : "cursor-not-allowed"} ${field.state.value.includes(NotificationChannel.EMAIL) ? "border-primary-muted" : "border-gray-200"}`}
                            onClick={() => {
                              if (!user.email) return;
                              const current = field.state.value;
                              
                              const next = current.includes(NotificationChannel.EMAIL)
                                ? current.filter(c => c !== NotificationChannel.EMAIL)
                                : [...current, NotificationChannel.EMAIL];
                              
                              field.handleChange(next);
                            }}
                          >
                            <div className='flex items-center gap-x-2'>
                              <div className='flex-center size-8 border border-gray-200 rounded-md bg-white'>
                                <TbMail className='size-5'/>  
                              </div>
                              <div className='flex flex-col max-w-48'>
                                <span className='text-[0.825rem] font-medium'>Email</span>
                              </div>
                            </div>
                            <input type="radio" readOnly checked={field.state.value.includes(NotificationChannel.EMAIL)} className='accent-primary-muted'/>
                          </div>
                        </>
                    )
                  }}
                />
              </div>
            </div>
          </section>
          <div className='py-4 flex items-center justify-end'>
            <Button className={`${isChanged ? "cursor-pointer  bg-primary-muted hover:bg-primary-muted/75 text-white" : "bg-gray-200 cursor-not-allowed!"}`} type="submit">
              <span className='text-sm'>Save changes</span>
            </Button>
          </div>
        </form>
      </main>
  )
}
