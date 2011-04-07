function(doc) {
  if (doc.type.indexOf("/type/sheet") >= 0) {
    emit(doc._id, doc);
  }
}