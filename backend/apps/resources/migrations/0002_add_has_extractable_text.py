from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="resource",
            name="has_extractable_text",
            field=models.BooleanField(default=True),
        ),
    ]
