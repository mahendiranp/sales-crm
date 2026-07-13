import "../index.css";
import { AuthProvider } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";
import Analytics from "../components/Analytics";

export default function MyApp({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <Analytics />
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ErrorBoundary>
  );
}
