'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { FamilyMemberEditor } from './family-member-editor';

interface Props {
  /** True if the account already has a primary member. Hides the "this is me"
   *  checkbox so we don't produce accidental duplicates. */
  hasPrimary: boolean;
}

/**
 * "Add a family member" toggle — keeps the blank editor tucked behind a
 * button so the page isn't visually noisy for users with 6+ members.
 */
export function FamilyAddButton({ hasPrimary }: Props) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={() => setOpen(true)}
        className="mt-6"
      >
        <Plus className="mr-1.5 size-4" />
        Add a family member
      </Button>
    );
  }
  return (
    <div className="mt-6">
      <FamilyMemberEditor
        forceIsPrimary={!hasPrimary}
        showPrimaryCheckbox={!hasPrimary}
        onSaved={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
