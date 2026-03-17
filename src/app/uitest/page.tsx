import { Button } from "../_components/UI/Button";
import {Badge} from "../_components/UI/Badge";
import {Card, CardBody, CardFooter, CardHeader, CardTitle} from "../_components/UI/Card";
import { NavSectionTitle, NavDivider, NavItem } from "../_components/layouts/Navitem";

function page() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg)]">
      <div className="p-10 flex flex-col gap-6">


      <div className="flex flex-wrap gap-3">
        <Badge variant="ok">نشط</Badge>
        <Badge variant="warn">منخفض</Badge>
        <Badge variant="danger">حرج</Badge>
        <Badge variant="info">معلومات</Badge>
        <Badge variant="gray">صيانة</Badge>
        <Badge variant="navy">GOV_ADMIN</Badge>
        <Badge variant="gold">FARMER</Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <Badge variant="ok" dot>نشط</Badge>
        <Badge variant="warn" dot>منخفض</Badge>
        <Badge variant="danger" dot>تسرب</Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost" >Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="success">Success</Button>
        <Button variant="gold">Gold</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="sm">Primary</Button>
        <Button variant="secondary" size="md">Secondary</Button>
        <Button variant="ghost" size="lg">Ghost</Button>
      </div>

        <Card>
        <CardHeader>
          <CardTitle> سجل الآبار</CardTitle>
          <Badge variant="ok">نشط</Badge>
        </CardHeader>
        <CardBody>
          <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
            محتوى الكارت هنا
          </p>
        </CardBody>
      </Card>

      {/* With footer */}
      <Card>
        <CardHeader>
          <CardTitle> التنبيهات</CardTitle>
          <Badge variant="danger">3 حرجة</Badge>
        </CardHeader>
        <CardBody size="sm">
          <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
            محتوى الكارت هنا
          </p>
        </CardBody>
        <CardFooter>
          <Button variant="ghost" size="sm">إلغاء</Button>
          <Button variant="primary" size="sm">حفظ</Button>
        </CardFooter>
      </Card>

      {/* KPI accent variants */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card accent="blue">
          <CardBody>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 6 }}>الآبار النشطة</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>1,312</div>
            <Badge variant="ok">✓ طبيعي</Badge>
          </CardBody>
        </Card>
        <Card accent="danger">
          <CardBody>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 6 }}>تنبيهات حرجة</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-danger)" }}>3</div>
            <Badge variant="danger">⚠ فورية</Badge>
          </CardBody>
        </Card>
        <Card accent="teal">
          <CardBody>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 6 }}>استهلاك اليوم</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>10.4M</div>
            <Badge variant="info">↓ 2% عن أمس</Badge>
          </CardBody>
        </Card>
        <Card accent="warn">
          <CardBody>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 6 }}>متوسط المنسوب</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>67%</div>
            <Badge variant="warn">↓ انخفاض</Badge>
          </CardBody>
        </Card>
      </div>
      </div>
    </div>
  )
}

export default page