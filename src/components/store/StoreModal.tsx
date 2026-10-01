import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import Modal from '../Modal';
import { Product, ProductKind, productById } from '../../lib/coinStore';
import { useUI } from '../../store';
import CoinStore from './CoinStore';
import Checkout from './Checkout';

/** The coin store dialog, opened from the + next to the balance (and the wallet). */
export default function StoreModal() {
  const view = useUI((s) => s.store);
  const close = () => useUI.getState().openStore(null);
  const [tab, setTab] = useState<ProductKind>('coins');
  const [picked, setPicked] = useState<Product | null>(null);
  useEffect(() => {
    if (!view) return;
    setTab(view.tab);
    setPicked(view.product ? productById(view.product) ?? null : null);
  }, [view]);
  return (
    <Modal open={!!view} onClose={close} wide title={<span className="flex items-center gap-2"><ShoppingBag size={18} className="text-gold" />{picked ? 'Checkout' : 'Coin store'}</span>}>
      {picked
        ? <Checkout key={picked.id} p={picked} onBack={() => setPicked(null)} onDone={close} />
        : <CoinStore tab={tab} setTab={setTab} onBuy={setPicked} compact />}
    </Modal>
  );
}
