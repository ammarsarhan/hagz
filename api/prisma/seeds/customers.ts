import { faker } from "@faker-js/faker";
import prisma from "@/shared/lib/utils/prisma.js";

export async function seedCustomers(pitches: any[], users: any[]) {
  console.log("Seeding pitch customers...");

  const allCustomers = [];

  for (const pitch of pitches) {
    const customerCount = faker.number.int({ min: 15, max: 30 });
    
    for (let i = 0; i < customerCount; i++) {
      const isRealUser = faker.number.float({ min: 0, max: 1 }) < 0.70;
      let customerData;

      if (isRealUser) {
        const user = faker.helpers.arrayElement(users);
        customerData = {
          pitchId: pitch.id,
          userId: user.id,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      } else {
        customerData = {
          pitchId: pitch.id,
          phone: faker.helpers.fromRegExp(/01[0125][0-9]{8}/),
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
        };
      }

      const customer = await prisma.pitchCustomer.upsert({
        where: {
          pitchId_phone: {
            pitchId: customerData.pitchId,
            phone: customerData.phone
          }
        },
        update: {},
        create: customerData
      });
      allCustomers.push(customer);
    }
  }

  console.log(`Successfully seeded ${allCustomers.length} pitch customers.`);
  return { customers: allCustomers };
}
