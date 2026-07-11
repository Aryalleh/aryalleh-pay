// GET / — redirect to the admin panel
export async function onRequestGet() {
    return new Response(null, { status: 302, headers: { Location: "/panel/" } });
}
