import { SallaContacts } from '@salla.sa/twilight-components-react/contacts';
import { useTwilight } from '@salla.sa/twilight-theme-engine';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { PageHeader } from '../navigation';
import { StoreSocial } from '../layout/StoreSocial';

/** `/account/contact`: every configured store contact channel. */
export function ContactPage() {
  const { t } = useTranslation();
  const { store } = useTwilight();

  return (
    <div className="flex min-h-full flex-col bg-smoke">
      <PageHeader title={t('pages.account.contact_us', 'تواصل معنا')} />
      <div className="p-4">
        <section className="rounded-xl bg-white p-4">
          <SallaContacts contacts={store.contacts} hideTitle />
          <StoreSocial social={store.social} className="mt-4 block" />
        </section>
      </div>
    </div>
  );
}
