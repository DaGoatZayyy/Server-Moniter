import ServerDashboard from "../../../components/server-dashboard";

export default async function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServerDashboard serverId={id} />;
}
