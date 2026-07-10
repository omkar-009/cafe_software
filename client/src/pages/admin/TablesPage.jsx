import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, QrCode, Trash2, Download, RefreshCw, LayoutGrid } from 'lucide-react';
import api, { request } from '@/lib/api';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, Skeleton, Spinner } from '@/components/ui';

const STATUS_TONE = { AVAILABLE: 'green', OCCUPIED: 'amber', RESERVED: 'blue', BILLED: 'purple', INACTIVE: 'gray' };

export default function TablesPage() {
  const qc = useQueryClient();
  const [tableModal, setTableModal] = useState(false);
  const [floorModal, setFloorModal] = useState(false);
  const [qrId, setQrId] = useState(null);

  const { data: floorData } = useQuery({ queryKey: ['floors'], queryFn: () => request(api.get('/tables/floors')) });
  const { data: tableData, isLoading } = useQuery({ queryKey: ['tables'], queryFn: () => request(api.get('/tables')) });

  const del = useMutation({ mutationFn: (id) => api.delete(`/tables/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tables'] }); toast.success('Table deleted'); } });
  const floors = floorData?.floors || [];
  const tables = tableData?.tables || [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Tables &amp; QR</h2><p className="text-sm text-zinc-500">{tables.length} tables · {floors.length} floors</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFloorModal(true)}>Add floor</Button>
          <Button onClick={() => setTableModal(true)}><Plus className="h-4 w-4" /> Add table</Button>
        </div>
      </div>

      {isLoading ? <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        : tables.length === 0 ? <Card><EmptyState icon={LayoutGrid} title="No tables" description="Create tables to generate QR codes." /></Card>
          : (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {tables.map((t) => (
                <Card key={t.id} className="flex flex-col items-center text-center" hover>
                  <div className="flex w-full items-start justify-between">
                    <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                    <button onClick={() => confirm(`Delete table ${t.table_number}?`) && del.mutate(t.id)} className="text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="my-2 grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-2xl font-black text-brand-600">{t.table_number}</div>
                  <p className="text-xs text-zinc-500">{t.floor_name || 'No floor'} · {t.seat_capacity} seats</p>
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setQrId(t.id)}><QrCode className="h-4 w-4" /> QR</Button>
                </Card>
              ))}
            </div>
          )}

      {tableModal && <TableModal floors={floors} onClose={() => setTableModal(false)} />}
      {floorModal && <FloorModal onClose={() => setFloorModal(false)} />}
      {qrId && <QrModal id={qrId} onClose={() => setQrId(null)} />}
    </div>
  );
}

function TableModal({ floors, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ tableNumber: '', floorId: floors[0]?.id || '', seatCapacity: 4 });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const create = useMutation({
    mutationFn: () => request(api.post('/tables', { tableNumber: form.tableNumber, floorId: form.floorId || undefined, seatCapacity: Number(form.seatCapacity) })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tables'] }); toast.success('Table created'); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Modal open onClose={onClose} title="Add table">
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
        <Input label="Table number" required value={form.tableNumber} onChange={set('tableNumber')} placeholder="09" />
        <Select label="Floor" value={form.floorId} onChange={set('floorId')}><option value="">None</option>{floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>
        <Input label="Seat capacity" type="number" value={form.seatCapacity} onChange={set('seatCapacity')} />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={create.isPending}>Create</Button></div>
      </form>
    </Modal>
  );
}

function FloorModal({ onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const create = useMutation({ mutationFn: () => request(api.post('/tables/floors', { name })), onSuccess: () => { qc.invalidateQueries({ queryKey: ['floors'] }); toast.success('Floor added'); onClose(); } });
  return (
    <Modal open onClose={onClose} title="Add floor">
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
        <Input label="Floor name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Rooftop" />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={create.isPending}>Add</Button></div>
      </form>
    </Modal>
  );
}

function QrModal({ id, onClose }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['qr', id], queryFn: () => request(api.get(`/tables/${id}/qr`)) });
  const regen = useMutation({
    mutationFn: () => request(api.post(`/tables/${id}/qr/regenerate`)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qr', id] }); toast.success('QR regenerated — old codes now invalid'); },
  });
  const download = () => {
    const a = document.createElement('a');
    a.href = data.qrImage; a.download = `table-${data.table.table_number}-qr.png`; a.click();
  };
  return (
    <Modal open onClose={onClose} title={data ? `Table ${data.table.table_number} — QR` : 'QR code'}>
      {isLoading ? <div className="grid h-64 place-items-center"><Spinner className="h-8 w-8" /></div> : (
        <div className="flex flex-col items-center">
          <div className="rounded-2xl bg-white p-4"><img src={data.qrImage} alt="QR" className="h-56 w-56" /></div>
          <p className="mt-3 break-all text-center text-xs text-zinc-400">{data.url}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={download}><Download className="h-4 w-4" /> Download</Button>
            <Button variant="secondary" onClick={() => regen.mutate()} loading={regen.isPending}><RefreshCw className="h-4 w-4" /> Regenerate</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
