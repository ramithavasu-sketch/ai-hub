import { HubProvider } from '@/lib/store';
import { match, useRoute } from '@/lib/router';
import { Shell } from '@/components/Shell';
import { EmptyState } from '@/components/hub';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmHost } from '@/components/confirm';
import { Welcome } from '@/components/Welcome';
import Home from '@/pages/Home';
import Explore from '@/pages/Explore';
import ProjectPage from '@/pages/ProjectPage';
import ProjectForm from '@/pages/ProjectForm';
import { People, Profile } from '@/pages/People';
import { Admin, DepartmentPage, Departments, MyProjects, Resources } from '@/pages/Other';

function Page({ path, query }: { path: string; query: URLSearchParams }) {
  let m;
  if (path === '/') return <Home />;
  if (path === '/projects') return <Explore query={query} />;
  if (path === '/new') return <ProjectForm />;
  if ((m = match('/projects/:id/edit', path))) return <ProjectForm key={m.id} id={m.id} />;
  if ((m = match('/projects/:id', path))) return <ProjectPage key={m.id} id={m.id} tab={query.get('tab') ?? undefined} />;
  if (path === '/people') return <People />;
  if ((m = match('/people/:id', path))) return <Profile key={m.id} id={m.id} />;
  if (path === '/departments') return <Departments />;
  if ((m = match('/departments/:id', path))) return <DepartmentPage key={m.id} id={m.id} query={query} />;
  if (path === '/resources') return <Resources />;
  if (path === '/mine') return <MyProjects />;
  if (path === '/admin') return <Admin />;
  return <EmptyState title="Page not found">That link doesn’t go anywhere yet.</EmptyState>;
}

export default function App() {
  const { path, query } = useRoute();
  return (
    <HubProvider>
      <Shell path={path}>
        <Page key={path + query.toString()} path={path} query={query} />
      </Shell>
      <Toaster position="bottom-right" richColors={false} />
      <ConfirmHost />
      <Welcome />
    </HubProvider>
  );
}
