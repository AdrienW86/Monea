-- Catalogue uniquement. Aucun client, compte administrateur, horaire ou identité fictive.
insert into public.services(id,slug,name,category,description,qualification_requirement,operational_status,bookable,price_cents,duration_minutes,sort_order)
select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,slug,name,category,description,requirement,
 case when n>=15 then 'study' when n<=5 then 'active' else 'coming_soon' end,n<=5,case when n>=15 then null else 2000 end,60,n-1
from (values
 (1,'extensions-cils','Extensions de cils','Le regard','Un travail de précision pour souligner votre regard.','none'),
 (2,'rehaussement-cils','Rehaussement de cils','Le regard','Une courbure délicate pour mettre les cils en valeur.','none'),
 (3,'browlift','Browlift','Le regard','Une mise en forme soignée de la ligne des sourcils.','none'),
 (4,'teinture','Teinture des cils et des sourcils','Le regard','Une touche de définition pour les cils et les sourcils.','none'),
 (5,'prothesie-ongulaire','Prothésie ongulaire','Les ongles','Pose de faux ongles, sans manucure préalable.','none'),
 (6,'manucure','Manucure · beauté des mains','Mains & pieds','Un soin esthétique dédié aux mains.','professional'),
 (7,'beaute-pieds','Beauté des pieds','Mains & pieds','Des soins esthétiques pour les pieds.','professional'),
 (8,'nettoyage-peau','Nettoyage de peau','Le visage','Un rituel de nettoyage de la peau.','professional'),
 (9,'soin-visage','Soins du visage','Le visage','Un moment de soin consacré au visage.','professional'),
 (10,'gommages-masques','Gommages et masques','Le visage','Des textures et des gestes de soin.','professional'),
 (11,'modelage','Modelage esthétique','Le corps','Un modelage esthétique du visage ou du corps, sans finalité thérapeutique.','professional'),
 (12,'epilation','Épilation à la cire','Le corps','Une prestation esthétique du visage ou du corps.','professional'),
 (13,'maquillage','Maquillage esthétique','Le maquillage','Une mise en beauté pour vos occasions.','professional'),
 (14,'spray-tan','Spray tan · douche bronzante','Le corps','Procédé et qualification en cours de vérification.','procedure'),
 (15,'luminotherapie','Luminothérapie','Prestations à l’étude','Matériel, sécurité et assurance à valider.','equipment'),
 (16,'uv','Appareil de bronzage UV','Prestations à l’étude','Formation, déclaration, contrôle et assurance spécifiques à valider.','equipment')
) v(n,slug,name,category,description,requirement)
on conflict(id) do nothing;
