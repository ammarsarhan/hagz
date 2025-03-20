export default interface UserType {
    id: number,
    name: string,
    email: string,
    phone: string
    status: "ACTIVE" | "UNVERIFIED" | "SUSPENDED" | "DELETED"
}