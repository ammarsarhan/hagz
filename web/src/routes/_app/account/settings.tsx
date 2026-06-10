import AreaAccordion from '#/components/app/AreaAccordion';
import Alert from '#/components/shared/Alert';
import Dropdown from '#/components/shared/Dropdown';
import Input from '#/components/shared/Input';
import MultiDropdown from '#/components/shared/MultiDropdown';
import { getDeviceCoordinates } from '#/lib/geolocation';
import type { GroundSize, GroundSport, Language } from '#/lib/types/user';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { TbUser, TbUsers } from 'react-icons/tb';

export const Route = createFileRoute('/_app/account/settings')({
  component: RouteComponent,

})

function RouteComponent() {
  const { user, locations } = Route.useRouteContext();
  const [error, setError] = useState<string | null>(null);
  
  const governorates = locations.map(group => ({ value: group.id, label: group.name, options: group.areas.map(item => ({ label: item.name, value: item.id }))}));

  const initial = {
    language: user.preferences.language,
    timezone: user.preferences.timezone,
    role: user.preferences.role,
    sizes: user.preferences.sizes,
    sports: user.preferences.sports,
    location: {
      area: user.preferences.location.area ?? "",
      longitude: String(user.preferences.location.longitude ?? "Not set"),
      latitude: String(user.preferences.location.latitude ?? "Not set"),
    },
    notifications: user.preferences.notifications
  };

  const form = useForm({
    defaultValues: initial
  });

  const getCoordinates = async () => {
    setError(null);
    const result = await getDeviceCoordinates();

    if (!result.success) {
      setError(result.error);
      return;
    }

    form.setFieldValue("location.latitude", String(result.latitude.toFixed(4)));
    form.setFieldValue("location.longitude", String(result.longitude.toFixed(4)));
  }

  return (
    <>
      {
        error &&
        <Alert message={error} code={"USER_DENIED_GEOLOCATION"} onClose={() => setError(null)} />
      }
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
                <h2 className='text-base font-medium'>Venue Size</h2>
                <p className='text-sm text-gray-500 mb-2'>Select your preferred pitch sizes to look for by default when searching for venues.</p>
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
                        onChange={(value) => field.handleChange(value as GroundSize[])}
                        className='max-w-sm'
                      />
                    )
                  }}
                />
              </div>
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
                        onChange={(value) => field.handleChange(value as GroundSport[])}
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
                  name="location.area"
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
            <div className='flex gap-x-12 py-8'>
              <div className="w-1/3 flex flex-col">
                <h2 className='text-base font-medium'>Location</h2>
                <p className='text-sm text-gray-500'>Get more accurate search results by updating your current location coordinates.</p>
                <button onClick={getCoordinates} className='text-primary-muted cursor-pointer w-fit text-sm mt-4'>Sync coordinates</button>
              </div>
              <div className="w-2/3 grid grid-cols-3 gap-x-4">
                <form.Field
                  name="location.longitude"
                  children={(field) => (
                    <Input 
                      label="Longitude"
                      value={field.state.value} 
                      onChange={(e) => field.handleChange(e.target.value)}
                      readOnly
                    />
                  )}
                />
                <form.Field
                  name="location.latitude"
                  children={(field) => (
                    <Input 
                      label="Latitude"
                      value={field.state.value} 
                      onChange={(e) => field.handleChange(e.target.value)}
                      readOnly
                    />
                  )}
                />
              </div>
            </div>
          </section>
        </form>
      </main>
    </>
  )
}
