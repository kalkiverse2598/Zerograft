/**
 * Tileset Builder Page Route
 * 
 * /tools/tileset-builder
 */

import { TilesetBuilderPage } from '@/components/tileset-builder';

export const metadata = {
    title: 'Tileset Builder | SpriteMancer',
    description: 'Generate game-ready tilesets with AI',
};

export default function TilesetBuilderRoute() {
    return <TilesetBuilderPage />;
}
