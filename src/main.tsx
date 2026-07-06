import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = lazy(() => import('./App.tsx'));

function LoadingFallback() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0f172a',color:'#94a3b8'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:40,height:40,border:'3px solid #1e293b',borderTopColor:'#3b82f6',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 16px'}}></div>
        <div>Carregando...</div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/*" element={<App />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
