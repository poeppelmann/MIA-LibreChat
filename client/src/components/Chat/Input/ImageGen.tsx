import React, { memo } from 'react';
import { Image } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';

function ImageGen() {
  const localize = useLocalize();
  const context = useBadgeRowContext();
  const { toggleState: imageGen, debouncedChange, isPinned } = context?.imageGen ?? {};

  return (
    (imageGen || isPinned) && (
      <CheckboxButton
        className="max-w-fit"
        checked={imageGen}
        setValue={debouncedChange}
        label={localize('com_ui_image_gen')}
        isCheckedClassName="border-pink-600/40 bg-pink-500/10 hover:bg-pink-700/10"
        icon={<Image className="icon-md" aria-hidden="true" />}
      />
    )
  );
}

export default memo(ImageGen);
