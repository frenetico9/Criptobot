
import React from 'react';
import { Asset, AssetType } from '../types';
import { MASTER_ASSET_LIST } from '../constants';

interface AssetSelectorProps {
  selectedAssetId: string;
  onAssetChange: (assetId: string) => void;
  disabled?: boolean;
}

const AssetSelector: React.FC<AssetSelectorProps> = ({ selectedAssetId, onAssetChange, disabled }) => {
  const groupedAssets = MASTER_ASSET_LIST.reduce((acc, asset) => {
    if (!acc[asset.type]) {
      acc[asset.type] = [];
    }
    acc[asset.type].push(asset);
    return acc;
  }, {} as Record<AssetType, Asset[]>);

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="asset-select" className="text-sm font-medium text-text_primary-light dark:text-text_primary-dark">
        Ativo:
      </label>
      <select
        id="asset-select"
        value={selectedAssetId}
        onChange={(e) => onAssetChange(e.target.value)}
        disabled={disabled}
        className="block w-full max-w-xs py-2 px-3 border border-gray-300 dark:border-gray-600 bg-surface-light dark:bg-surface-dark rounded-md shadow-sm focus:outline-none focus:ring-primary dark:focus:ring-primary-dark focus:border-primary dark:focus:border-primary-dark sm:text-sm text-text_primary-light dark:text-text_primary-dark"
      >
        {Object.entries(groupedAssets).map(([type, assets]) => (
          <optgroup label={type} key={type}>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};

export default AssetSelector;
