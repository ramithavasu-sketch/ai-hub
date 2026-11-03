import { useState } from 'react';
import { useHub } from '@/lib/store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/** First sign-in on the live site: ask for job title and department so profiles make sense. */
export function Welcome() {
  const { db, me, live, act } = useHub();
  const [name, setName] = useState(me.name);
  const [title, setTitle] = useState(me.title);
  const [dept, setDept] = useState(me.departmentId);
  if (!live || (me.title && me.departmentId)) return null;

  const save = () => act((api) => api.updateProfile({ name, title, departmentId: dept }), 'Welcome to the AI Hub');

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="display text-2xl font-normal">Welcome to the AI Hub</DialogTitle>
          <DialogDescription>Tell colleagues a little about you. You can change this later from your profile.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="welcome-name">Your name</Label>
            <Input id="welcome-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="As colleagues know you" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="welcome-title">Job title</Label>
            <Input id="welcome-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. QA Lead" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="welcome-dept">Department</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger id="welcome-dept" className="h-10! w-full"><SelectValue placeholder="Choose your department" /></SelectTrigger>
              <SelectContent>{db.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={!name.trim() || !title.trim() || !dept}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
