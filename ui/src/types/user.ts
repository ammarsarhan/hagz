export default interface UserType {
    id: number,
    name: string,
    email: string,
    phone: string
    status: "ACTIVE" | "UNVERIFIED" | "SUSPENDED" | "DELETED"
}

export type OwnerType = UserType & {
    pitches: {
        id: string,
        name: string,
        grounds: number
    }[],
    company?: string
}