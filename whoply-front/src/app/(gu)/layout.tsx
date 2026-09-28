import { RootDocument, rootMetadata, rootViewport } from '../root';

export const metadata = rootMetadata;
export const viewport = rootViewport;

export default function Layout({ children }: { children: React.ReactNode }) {
    return <RootDocument lang="gu">{children}</RootDocument>;
}
