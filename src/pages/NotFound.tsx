import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 pt-20 text-center">
      <img src="./img/strip-neon.webp" alt="" className="mx-auto w-64 rounded-2xl animate-flicker" />
      <h1 className="mt-8 h-display text-6xl text-gold-grad">404</h1>
      <p className="mt-2 text-smoke">This chicken crossed the road and never came back.</p>
      <Link to="/" className="btn-gold mt-6 px-6 py-3">Back to the lobby</Link>
    </div>
  );
}
