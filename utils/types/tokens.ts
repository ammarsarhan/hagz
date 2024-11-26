export interface CreationTokenType {
    email: string
    name: string
    exp: number
    iat: number
    id: string
}

export interface OwnerAccessTokenType {
    exp: number,
    iat: number,
    name: string,
    email: string,
    id: string,
    role: "Owner" | "User"
}

export interface OwnerRefreshTokenType {
    exp: number,
    iat: number,
    id: string
}