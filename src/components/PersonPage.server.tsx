/**
 * PersonPage.server — SSR entry for the 1:1 buyer page.
 *
 * Renders the same tree as the client component minus the scroll-reveal
 * effect, so every section ships visible and hydration takes over cleanly.
 */

import type { PersonPage as PersonPageType } from '../lib/graph-types';
import PersonPageView from './PersonPageView';

interface Props {
    page: PersonPageType;
    editMode?: boolean;
}

export default function PersonPageServer({ page, editMode }: Props) {
    return <PersonPageView page={page} editMode={editMode} />;
}
