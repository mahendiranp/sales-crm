import RequireApp from "../../../components/RequireApp";
import { AddFormPage } from "../../../views/Forms";

export default function AppFormNewPage() {
  return (
    <RequireApp appKey="forms">
      <AddFormPage />
    </RequireApp>
  );
}
