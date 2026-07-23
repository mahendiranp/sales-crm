import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RequireApp from "../../../../components/RequireApp";
import FormResponses from "../../../../views/FormResponses";

export default function AppFormResponsesPage() {
  const router = useRouter();
  const { id, highlight } = router.query;

  return (
    <RequireApp appKey="forms">
      <div>
        <Link href="/app/forms" className="text-sm text-primary font-medium flex items-center gap-1 mb-4 hover:underline w-fit">
          <ArrowLeft size={14} /> Back to Forms
        </Link>
        {id && <FormResponses formId={id} highlightResponseId={highlight} />}
      </div>
    </RequireApp>
  );
}
