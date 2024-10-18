export default interface Location {
    longitude: number;
    latitude: number;
    building?: string;
    street: string;
    address: string;
    city?: string;
    governorate: string;
}