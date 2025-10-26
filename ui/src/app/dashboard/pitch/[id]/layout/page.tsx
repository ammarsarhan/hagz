export default async function Layout({
    params,
} : {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;

    return (
        <div>
            
        </div>
    );
};